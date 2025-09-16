const { clone, flattenOr, isFalse, isTrue, simplifyContradictions, areContradictory, extractAllLiteralsFromConjunction } = require('./ast_utils');
const { pushNao } = require('./prenex');

function distributeOrOverAnd(node) {
    if (!node) return node;
    
    if (node.type === 'ou') {
        let A = distributeOrOverAnd(node.left);
        let B = distributeOrOverAnd(node.right);
        
        // (A ∨ (B ∧ C)) => (A ∨ B) ∧ (A ∨ C)
        if (A && A.type === 'e') {
            return {
                type: 'e',
                left: distributeOrOverAnd({ type: 'ou', left: A.left, right: B }),
                right: distributeOrOverAnd({ type: 'ou', left: A.right, right: B })
            };
        }
        
        if (B && B.type === 'e') {
            return {
                type: 'e',
                left: distributeOrOverAnd({ type: 'ou', left: A, right: B.left }),
                right: distributeOrOverAnd({ type: 'ou', left: A, right: B.right })
            };
        }
        
        // Caso especial: flatten associatividade de OR
        return flattenOr({ type: 'ou', left: A, right: B });
    }
    
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
    
    return node; // átomo
}

function toCNFMatrix(matrix) {
    // empurra negações
    let m = pushNao(clone(matrix));
    let cnf = distributeOrOverAnd(m);
    cnf = simplifyContradictions(cnf);

    return cnf;
}

function createAndSimplify(left, right) {
    if (isFalse(left) || isFalse(right)) return { type: 'false' };
    if (isTrue(left)) return right;
    if (isTrue(right)) return left;
    
    // Verifica contradição imediata
    if (areContradictory(left, right)) return { type: 'false' };
    
    // Para conjunções mais complexas, extrai literais e verifica contradições
    let allLiterals = extractAllLiteralsFromConjunction({ type: 'e', left, right });
    if (hasContradictionInLiterals(allLiterals)) {
        return { type: 'false' };
    }
    
    return { type: 'e', left, right };
}

function createOrSimplify(left, right) {
    if (isTrue(left) || isTrue(right)) return { type: 'true' };
    if (isFalse(left)) return right;
    if (isFalse(right)) return left;
    
    return { type: 'ou', left, right };
}

function distributeAndOverOrWithSimplification(node) {
    if (!node) return node;
    
    if (node.type === 'e') {
        let A = distributeAndOverOrWithSimplification(node.left);
        let B = distributeAndOverOrWithSimplification(node.right);
        
        if (isFalse(A) || isFalse(B)) return { type: 'false' };
        if (isTrue(A)) return B;
        if (isTrue(B)) return A;
        
        // Verifica contradição entre A e B
        if (areContradictory(A, B)) return { type: 'false' };
        
        // (A ∧ (B ∨ C)) => (A ∧ B) ∨ (A ∧ C)
        if (A && A.type === 'ou') {
            let leftTerm = createAndSimplify(A.left, B);
            let rightTerm = createAndSimplify(A.right, B);
            return createOrSimplify(leftTerm, rightTerm);
        }
        
        if (B && B.type === 'ou') {
            let leftTerm = createAndSimplify(A, B.left);
            let rightTerm = createAndSimplify(A, B.right);
            return createOrSimplify(leftTerm, rightTerm);
        }
        
        return createAndSimplify(A, B);
    }
    
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

function toDNFMatrix(matrix) {
    // Empurra negações
    let m = pushNao(clone(matrix));
    
    // Distribui AND sobre OR com simplificação durante o processo
    let dnf = distributeAndOverOrWithSimplification(m);
    
    // Simplificação final
    dnf = simplifyContradictions(dnf);
    
    return dnf;
}

function collectClauses(node) {
    const clauses = [];
    
    function collect(currentNode) {
        if (!currentNode) return;
        
        switch (currentNode.type) {
            case 'e':
                // Recursivamente coleta de ambos os lados
                collect(currentNode.left);
                collect(currentNode.right);
                break;
                
            case 'ou':
                // Cláusula completa
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
    
    function collectLiteralsFromDisjunction(disjunctionNode, literals) {
        if (!disjunctionNode) return;
        
        if (disjunctionNode.type === 'ou') {
            // Recursivamente coleta literais da disjunção
            collectLiteralsFromDisjunction(disjunctionNode.left, literals);
            collectLiteralsFromDisjunction(disjunctionNode.right, literals);
        } else if (disjunctionNode.type === 'nao') {
            // Literal negativo
            literals.push({ neg: true, atom: disjunctionNode.value });
        } else {
            // Literal positivo
            literals.push({ neg: false, atom: disjunctionNode });
        }
    }
    
    if (!node) return clauses;

    collect(node);

    return clauses;
}

function hasContradictionInLiterals(literals) {
    for (let i = 0; i < literals.length; i++) {
        for (let j = i + 1; j < literals.length; j++) {
            let lit1 = literals[i];
            let lit2 = literals[j];
            
            // P e ¬P são contraditórios
            if (hasContradiction(lit1, lit2)) {
                return true;
            }
        }
    }
    return false;
}

function hasContradiction(lit1, lit2) {
    // Verifica se dois literais são contraditórios (P e ¬P)
    if (lit1.neg === !lit2.neg) {
        const atom1 = JSON.stringify(lit1.atom);
        const atom2 = JSON.stringify(lit2.atom);
        return atom1 === atom2;
    }
    return false;
}

function isHornClause(clause) {
    let positive = 0;
    for (let l of clause) {
        if (!l.neg) positive++;
        if (positive > 1) return false;
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