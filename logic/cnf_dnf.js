const { clone, flattenOr, isFalse, isTrue, simplifyContradictions, areContradictory, extractAllLiteralsFromConjunction } = require('./ast_utils');
const { pushNao } = require('./prenex');

// Distribui OR sobre AND: (A ∨ (B ∧ C)) → (A ∨ B) ∧ (A ∨ C)
function distributeOrOverAnd(node) {
    if (!node) return node;
    
    if (node.type === 'ou') {
        let A = distributeOrOverAnd(node.left);
        let B = distributeOrOverAnd(node.right);
        
        // Caso: A é conjunção - distribui B sobre ela
        if (A && A.type === 'e') {
            return {
                type: 'e',
                left: distributeOrOverAnd({ type: 'ou', left: A.left, right: B }),
                right: distributeOrOverAnd({ type: 'ou', left: A.right, right: B })
            };
        }
        
        // Caso: B é conjunção - distribui A sobre ela
        if (B && B.type === 'e') {
            return {
                type: 'e',
                left: distributeOrOverAnd({ type: 'ou', left: A, right: B.left }),
                right: distributeOrOverAnd({ type: 'ou', left: A, right: B.right })
            };
        }
        
        // Normaliza associatividade de OR
        return flattenOr({ type: 'ou', left: A, right: B });
    }
    
    // Processa recursivamente conjunções e negações
    if (node.type === 'e') {
        return {
            type: 'e',
            left: distributeOrOverAnd(node.left),
            right: distributeOrOverAnd(node.right)
        };
    }
    
    if (node.type === 'nao') {
        return {
            type: 'nao',
            value: distributeOrOverAnd(node.value)
        };
    }
    
    return node; // Átomo
}

// Converte matriz para Forma Normal Conjuntiva (CNF)
function toCNFMatrix(matrix) {
    let m = pushNao(clone(matrix));        // Empurra negações para átomos
    let cnf = distributeOrOverAnd(m);      // Distribui OR sobre AND
    cnf = simplifyContradictions(cnf);     // Remove contradições e tautologias

    return cnf;
}

// Cria conjunção com simplificações automáticas
function createAndSimplify(left, right) {
    // Regras básicas: FALSE ∧ X = FALSE, TRUE ∧ X = X
    if (isFalse(left) || isFalse(right)) return { type: 'false' };
    if (isTrue(left)) return right;
    if (isTrue(right)) return left;
    
    // Contradição direta: A ∧ ¬A = FALSE
    if (areContradictory(left, right)) return { type: 'false' };
    
    // Verifica contradições em conjunções complexas
    let allLiterals = extractAllLiteralsFromConjunction({ type: 'e', left, right });
    if (hasContradictionInLiterals(allLiterals)) {
        return { type: 'false' };
    }
    
    return { type: 'e', left, right };
}

// Cria disjunção com simplificações automáticas
function createOrSimplify(left, right) {
    // Regras básicas: TRUE ∨ X = TRUE, FALSE ∨ X = X
    if (isTrue(left) || isTrue(right)) return { type: 'true' };
    if (isFalse(left)) return right;
    if (isFalse(right)) return left;
    
    return { type: 'ou', left, right };
}

// Distribui AND sobre OR com simplificações: (A ∧ (B ∨ C)) → (A ∧ B) ∨ (A ∧ C)
function distributeAndOverOrWithSimplification(node) {
    if (!node) return node;
    
    if (node.type === 'e') {
        let A = distributeAndOverOrWithSimplification(node.left);
        let B = distributeAndOverOrWithSimplification(node.right);
        
        // Simplificações básicas
        if (isFalse(A) || isFalse(B)) return { type: 'false' };
        if (isTrue(A)) return B;
        if (isTrue(B)) return A;
        
        // Contradição: A ∧ ¬A = FALSE
        if (areContradictory(A, B)) return { type: 'false' };
        
        // Caso: A é disjunção - distribui sobre B
        if (A && A.type === 'ou') {
            let leftTerm = createAndSimplify(A.left, B);
            let rightTerm = createAndSimplify(A.right, B);
            return createOrSimplify(leftTerm, rightTerm);
        }
        
        // Caso: B é disjunção - distribui A sobre ela
        if (B && B.type === 'ou') {
            let leftTerm = createAndSimplify(A, B.left);
            let rightTerm = createAndSimplify(A, B.right);
            return createOrSimplify(leftTerm, rightTerm);
        }
        
        return createAndSimplify(A, B);
    }
    
    // Processa recursivamente disjunções e negações
    if (node.type === 'ou') {
        let left = distributeAndOverOrWithSimplification(node.left);
        let right = distributeAndOverOrWithSimplification(node.right);
        return createOrSimplify(left, right);
    }
    
    if (node.type === 'nao') {
        return { type: 'nao', value: distributeAndOverOrWithSimplification(node.value) };
    }
    
    return node;
}

// Converte matriz para Forma Normal Disjuntiva (DNF)
function toDNFMatrix(matrix) {
    let m = pushNao(clone(matrix));                        // Empurra negações para átomos
    let dnf = distributeAndOverOrWithSimplification(m);    // Distribui AND sobre OR
    dnf = simplifyContradictions(dnf);                     // Simplificação final
    
    return dnf;
}

// Extrai cláusulas de uma fórmula CNF para representação em lista
function collectClauses(node) {
    const clauses = [];
    
    // Coleta cláusulas recursivamente
    function collect(currentNode) {
        if (!currentNode) return;
        
        switch (currentNode.type) {
            case 'e':
                // Conjunção: coleta de ambos os lados
                collect(currentNode.left);
                collect(currentNode.right);
                break;
                
            case 'ou':
                // Disjunção: forma uma cláusula completa
                const literals = [];
                collectLiteralsFromDisjunction(currentNode, literals);
                if (literals.length > 0) {
                    clauses.push(literals);
                }
                break;
                
            case 'nao':
                // Literal negativo isolado
                clauses.push([{ neg: true, atom: currentNode.value }]);
                break;
                
            case 'predicado':
            case 'variavel':
                // Literal positivo isolado
                clauses.push([{ neg: false, atom: currentNode }]);
                break;
                
            default:
                console.warn(`Tipo de nó não esperado em CNF: ${currentNode.type}`);
                break;
        }
    }
    
    // Extrai todos os literais de uma disjunção
    function collectLiteralsFromDisjunction(disjunctionNode, literals) {
        if (!disjunctionNode) return;
        
        if (disjunctionNode.type === 'ou') {
            // Desce recursivamente pela disjunção
            collectLiteralsFromDisjunction(disjunctionNode.left, literals);
            collectLiteralsFromDisjunction(disjunctionNode.right, literals);
        } else if (disjunctionNode.type === 'nao') {
            // Literal negativo
            literals.push({ neg: true, atom: disjunctionNode.value });
        } else {
            // Literal positivo (predicado ou variável)
            literals.push({ neg: false, atom: disjunctionNode });
        }
    }
    
    if (!node) return clauses;

    collect(node);

    return clauses;
}

// Verifica se uma lista de literais contém contradição (P e ¬P)
function hasContradictionInLiterals(literals) {
    for (let i = 0; i < literals.length; i++) {
        for (let j = i + 1; j < literals.length; j++) {
            let lit1 = literals[i];
            let lit2 = literals[j];
            
            if (hasContradiction(lit1, lit2)) {
                return true;
            }
        }
    }
    return false;
}

// Verifica se dois literais são contraditórios
function hasContradiction(lit1, lit2) {
    // P e ¬P: mesmo átomo, negações opostas
    if (lit1.neg === !lit2.neg) {
        const atom1 = JSON.stringify(lit1.atom);
        const atom2 = JSON.stringify(lit2.atom);
        return atom1 === atom2;
    }
    return false;
}

// Verifica se uma cláusula é Horn (no máximo um literal positivo)
function isHornClause(clause) {
    let positive = 0;
    for (let l of clause) {
        if (!l.neg) positive++;
        if (positive > 1) return false; // Mais de um positivo = não-Horn
    }
    return true;
}

module.exports = {
    toCNFMatrix,
    toDNFMatrix,
    collectClauses,
    isHornClause,
    hasContradictionInLiterals,
    hasContradiction
};