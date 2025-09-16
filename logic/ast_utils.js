function clone(node) { 
    return JSON.parse(JSON.stringify(node)); 
}

function areContradictory(node1, node2) {
    if (!node1 || !node2) return false;

    // Usa comparação de string para verificar se um nó é a negação do outro
    if (node1.type === 'nao' && astToString(node1.value) === astToString(node2)) return true;
    if (node2.type === 'nao' && astToString(node2.value) === astToString(node1)) return true;

    return false;
}

function flattenOr(node) {
    if (!node || node.type !== 'ou') return node;
    
    let literals = [];
    
    function collectOrLiterals(n) {
        if (n && n.type === 'ou') {
            collectOrLiterals(n.left);
            collectOrLiterals(n.right);
        } else if (n) {
            literals.push(n);
        }
    }
    
    collectOrLiterals(node);
    
    if (literals.length === 1) return literals[0];
    if (literals.length === 2) {
        return { type: 'ou', left: literals[0], right: literals[1] };
    }
    
    let result = literals[literals.length - 1];
    for (let i = literals.length - 2; i >= 0; i--) {
        result = { type: 'ou', left: literals[i], right: result };
    }
    
    return result;
}

function isFalse(node) {
    return node && node.type === 'false';
}

function isTrue(node) {
    return node && node.type === 'true';
}

function simplifyContradictions(node) {
    if (!node) return node;
    
    // Processa recursivamente
    if (node.type === 'e') {
        let left = simplifyContradictions(node.left);
        let right = simplifyContradictions(node.right);
        
        // Se algum lado é FALSE, toda conjunção é FALSE
        if (isFalse(left) || isFalse(right)) {
            return { type: 'false' };
        }
        
        // Se um lado é TRUE, retorna o outro
        if (isTrue(left)) return right;
        if (isTrue(right)) return left;
        
        // Verifica contradições diretas
        if (areContradictory(left, right)) {
            return { type: 'false' };
        }
        
        // Verifica contradições
        let allLiterals = extractLiteralsFromConjunction({ type: 'e', left, right });
        if (hasContradiction(allLiterals)) {
            return { type: 'false' };
        }
        
        return { type: 'e', left, right };
    }
    
    if (node.type === 'ou') {
        let left = simplifyContradictions(node.left);
        let right = simplifyContradictions(node.right);
        
        // Se algum lado é TRUE ou FALSE, trata adequadamente
        if (isTrue(left) || isTrue(right)) {
            return { type: 'true' };
        }

        if (isFalse(left) && isFalse(right)) {
            return { type: 'false' };
        }

        if (isFalse(left)) return right;
        if (isFalse(right)) return left;

        if (areContradictory(left, right)) {
            return { type: 'true' };
        }

        return { type: 'ou', left, right };
    }
    
    if (node.type === 'nao') {
        let simplified = simplifyContradictions(node.value);
        if (isFalse(simplified)) return { type: 'true' };
        if (isTrue(simplified)) return { type: 'false' };
        return { type: 'nao', value: simplified };
    }
    
    return node;
}

function extractLiteralsFromConjunction(node) {
    let literals = [];
    
    function extract(n) {
        if (n && n.type === 'e') {
            extract(n.left);
            extract(n.right);
        } else if (n) {
            literals.push(n);
        }
    }
    
    extract(node);
    return literals;
}

function hasContradiction(literals) {
    for (let i = 0; i < literals.length; i++) {
        for (let j = i + 1; j < literals.length; j++) {
            if (areContradictory(literals[i], literals[j])) {
                return true;
            }
        }
    }
    return false;
}

function isAtom(n) {
    return n.type === 'predicado' || n.type === 'variavel';
}

function astToString(node) {
    if (!node) return '';
    
    switch (node.type) {
        case 'predicado':
            if (node.args && node.args.length > 0) {
                const args = node.args.map(arg => astToString(arg)).join(', ');
                return `${node.name}(${args})`;
            }
            return node.name;
            
        case 'variavel':
            return node.name;

        case 'false':
            return 'FALSE';
            
        case 'true':
            return 'TRUE';
            
        case 'nao':
            return `¬${astToString(node.value)}`;
            
        case 'e':
            return `(${astToString(node.left)} ∧ ${astToString(node.right)})`;
            
        case 'ou':
            return `(${astToString(node.left)} ∨ ${astToString(node.right)})`;
            
        case 'implicacao':
            return `(${astToString(node.left)} → ${astToString(node.right)})`;
            
        case 'bicondicional':
            return `(${astToString(node.left)} ↔ ${astToString(node.right)})`;
            
        case 'paratodos':
            if (Array.isArray(node.vars)) {
                return `∀${node.vars.join(',')} ${astToString(node.body)}`;
            }
            return `∀${node.vars} ${astToString(node.body)}`;
            
        case 'existe':
            if (Array.isArray(node.vars)) {
                return `∃${node.vars.join(',')} ${astToString(node.body)}`;
            }
            return `∃${node.vars} ${astToString(node.body)}`;
            
        default:
            return '';
    }
}

function renameVar(oldVar, contextNode, usedVars = new Set()) {
    checkVarName(contextNode, usedVars);
    
    let counter = 1;
    let newVar = oldVar;
    
    while (usedVars.has(newVar)) {
        newVar = `${oldVar}${counter}`;
        counter++;
    }
    
    return newVar;
}

function checkVarName(node, varsSet) {
    if (!node) return;
    
    if (node.type === 'variavel') {
        varsSet.add(node.name);
    }
    
    if (node.vars && Array.isArray(node.vars)) {
        node.vars.forEach(v => varsSet.add(v));
    }
    
    if (node.left) checkVarName(node.left, varsSet);
    if (node.right) checkVarName(node.right, varsSet);
    if (node.body) checkVarName(node.body, varsSet);
    if (node.value) checkVarName(node.value, varsSet);
}

function substitute(node, oldVar, newVar) {
    if (!node) return node;
    
    if (node.type === 'variavel' && node.name === oldVar) {
        return { type: 'variavel', name: newVar };
    }
    
    // Não substitui se a variável de quantificadores estiver ligada
    if ((isQuant(node)) && 
        node.vars && node.vars.includes(oldVar)) {
        return node;
    }
    
    let newNode = clone(node);
    
    if (newNode.left) newNode.left = substitute(newNode.left, oldVar, newVar);
    if (newNode.right) newNode.right = substitute(newNode.right, oldVar, newVar);
    if (newNode.body) newNode.body = substitute(newNode.body, oldVar, newVar);
    if (newNode.value) newNode.value = substitute(newNode.value, oldVar, newVar);
    
    if (newNode.args && Array.isArray(newNode.args)) {
        newNode.args = newNode.args.map(arg => substitute(arg, oldVar, newVar));
    }
    
    return newNode;
}

function hasFreeVar(node, varName) {
    const foundVars = new Set();
    checkVarName(node, foundVars);
    return foundVars.has(varName);
}

function isQuant(node) {
    return node && (node.type === 'paratodos' || node.type === 'existe');
}

function arraysEqual(arr1, arr2) {
    return arr1.length === arr2.length && arr1.every((val, idx) => val === arr2[idx]);
}

function extractAllLiteralsFromConjunction(node) {
    let literals = [];
    
    function extract(n) {
        if (!n) return;
        
        if (n.type === 'e') {
            extract(n.left);
            extract(n.right);
        } else if (n.type === 'nao') {
            literals.push({ neg: true, atom: n.value });
        } else if (n.type === 'predicado' || n.type === 'variavel') {
            literals.push({ neg: false, atom: n });
        }
    }
    
    extract(node);
    return literals;
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

function splitPrenex(node) {
    if (!node) {
        return { quantifiers: [], matrix: node };
    }
    
    let quantifiers = [];
    
    // Extrai quantificadores e constroi nova matriz
    function extractQuantifiers(n) {
        if (!n) return n;
        
        if (n.type === 'paratodos' || n.type === 'existe') {
            // Encontrou um quantificador, adiciona à lista e processa o corpo
            quantifiers.push({
                type: n.type,
                vars: Array.isArray(n.vars) ? n.vars.slice() : [n.vars]
            });
            return extractQuantifiers(n.body);
        }
        
        // Para outros tipos de nó, processa recursivamente os filhos
        let newNode = clone(n);
        if (newNode.left) {
            newNode.left = extractQuantifiers(newNode.left);
        }
        if (newNode.right) {
            newNode.right = extractQuantifiers(newNode.right);
        }
        if (newNode.value) {
            newNode.value = extractQuantifiers(newNode.value);
        }
        if (newNode.body) {
            newNode.body = extractQuantifiers(newNode.body);
        }
        
        return newNode;
    }
    
    let matrix = extractQuantifiers(clone(node));
    
    return { quantifiers, matrix };
}

module.exports = {
    clone,
    areContradictory,
    flattenOr,
    isFalse,
    isTrue,
    simplifyContradictions,
    extractLiteralsFromConjunction,
    hasContradiction,
    isAtom,
    astToString,
    renameVar,
    checkVarName,
    substitute,
    hasFreeVar,
    isQuant,
    arraysEqual,
    extractAllLiteralsFromConjunction,
    hasContradictionInLiterals,
    splitPrenex
};