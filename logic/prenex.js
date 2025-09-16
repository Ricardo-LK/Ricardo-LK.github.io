const { clone, isAtom, astToString, renameVar, hasFreeVar, substitute, isQuant, arraysEqual } = require('./ast_utils');

function removeImplic(node) {
     if (!node || isAtom(node)) return node;

    if (node.left) node.left = removeImplic(node.left);
    if (node.right) node.right = removeImplic(node.right);
    if (node.body) node.body = removeImplic(node.body);
    if (node.value) node.value = removeImplic(node.value);

    if (node.type === 'implicacao') {
        return { 
            type: 'ou', 
            left: { type: 'nao', value: node.left }, 
            right: node.right 
        };
    }
    
    return node;
}

function removeBicon(node) {
    if (!node || isAtom(node)) return node;

    // Primeiro processa recursivamente todos os nós filhos
    if (node.left) node.left = removeBicon(node.left);
    if (node.right) node.right = removeBicon(node.right);
    if (node.body) node.body = removeBicon(node.body);
    if (node.value) node.value = removeBicon(node.value);

    // Transforma bicondicionais
    if (node.type === 'bicondicional') {
        let a = clone(node.left);
        let b = clone(node.right);
        return {
            type: 'e',
            left: { type: 'ou', left: { type: 'nao', value: a }, right: b },
            right: { type: 'ou', left: { type: 'nao', value: b }, right: a }
        };
    }
    
    return node;
}

function pushNao(node) {
    if (!node) return node;

    if (node.type === 'nao') {
        let v = node.value;
        if (v.type === 'nao') return pushNao(v.value); // ¬¬A = A
        if (v.type === 'e') return { 
            type: 'ou', 
            left: pushNao({ type: 'nao', value: v.left }), 
            right: pushNao({ type: 'nao', value: v.right }) 
        };
        if (v.type === 'ou') return { 
            type: 'e', 
            left: pushNao({ type: 'nao', value: v.left }), 
            right: pushNao({ type: 'nao', value: v.right }) 
        };
    }

    // Processar recursivamente todos os nós
    let result = { ...node };
    if (node.left) result.left = pushNao(node.left);
    if (node.right) result.right = pushNao(node.right);
    if (node.body) result.body = pushNao(node.body);
    if (node.value) result.value = pushNao(node.value);
    
    return result;
}

function removeNaoQuant(node) {
    if (!node) return node;

    if (node.type === 'nao') {
        let v = node.value;
        if (v.type === 'paratodos') {
            return { type: 'existe', vars: v.vars, body: removeNaoQuant({ type: 'nao', value: v.body }) };
        }
        if (v.type === 'existe') {
            return { type: 'paratodos', vars: v.vars, body: removeNaoQuant({ type: 'nao', value: v.body }) };
        }
    }

    if (node.left) node.left = removeNaoQuant(node.left);
    if (node.right) node.right = removeNaoQuant(node.right);
    if (node.body) node.body = removeNaoQuant(node.body);
    if (node.value) node.value = removeNaoQuant(node.value);

    return node;
}

function pullQuantAtomo(node) {
    if (!node || !node.left || !node.right) return node;
    
    node.left = pullQuantAtomo(node.left);
    node.right = pullQuantAtomo(node.right);
    
    if (isQuant(node.left) && isQuant(node.right) &&
        node.left.type === node.right.type && 
        arraysEqual(node.left.vars, node.right.vars)) {
        
        return {
            type: node.left.type,
            vars: node.left.vars,
            body: {
                type: node.type,
                left: node.left.body,
                right: node.right.body
            }
        };
    }
    
    // Left é quantificador right não
    if (isQuant(node.left) && !isQuant(node.right)) {
        return substituteQuantLeft(node);
    }
    
    // Right é quantificador left não
    if (!isQuant(node.left) && isQuant(node.right)) {
        return substituteQuantRight(node);
    }
    
    // Left e Right são quantificadores
    if (isQuant(node.left) && isQuant(node.right)) {
        return substituteQuants(node);
    }
    
    return node;
}

function substituteQuantLeft(node) {
    const quantVar = node.left.vars[0];
    const quantType = node.left.type;
    
    if (!hasFreeVar(node.right, quantVar)) { // Livre right
        return {
            type: quantType,
            vars: [quantVar],
            body: {
                type: node.type,
                left: node.left.body,
                right: node.right
            }
        };

    } else {
        const newVar = renameVar(quantVar, node);
        const renamedBody = substitute(node.left.body, quantVar, newVar);
        
        return {
            type: quantType,
            vars: [newVar],
            body: {
                type: node.type,
                left: renamedBody,
                right: node.right
            }
        };
    }
}

function substituteQuantRight(node) {
    const quantVar = node.right.vars[0];
    const quantType = node.right.type;
    
    if (!hasFreeVar(node.left, quantVar)) { // Livre left
        return {
            type: quantType,
            vars: [quantVar],
            body: {
                type: node.type,
                left: node.left,
                right: node.right.body
            }
        };

    } else {
        const newVar = renameVar(quantVar, node);
        const renamedBody = substitute(node.right.body, quantVar, newVar);
        
        return {
            type: quantType,
            vars: [newVar],
            body: {
                type: node.type,
                left: node.left,
                right: renamedBody
            }
        };
    }
}

function substituteQuants(node) {
    // Esquerda
    let tempNode = substituteQuantLeft(node);
    
    // Direita
    if (tempNode === node) {
        tempNode = substituteQuantRight(node);
    }
    
    // Esquerda/Direita
    if (tempNode === node) {
        return substituteQuantLeftERight(node);
    }
    
    return pullQuantAtomo(tempNode);
}

function substituteQuantLeftERight(node) {
    const leftVar = node.left.vars[0];
    const rightVar = node.right.vars[0];
    const leftType = node.left.type;
    const rightType = node.right.type;
    
    const newLeftVar = renameVar(leftVar, node);
    const newRightVar = renameVar(rightVar, node);
    
    const renamedLeftBody = substitute(node.left.body, leftVar, newLeftVar);
    const renamedRightBody = substitute(node.right.body, rightVar, newRightVar);
    
    const newLeftQuant = {
        type: leftType,
        vars: [newLeftVar],
        body: renamedLeftBody
    };
    
    const newRightQuant = {
        type: rightType,
        vars: [newRightVar],
        body: renamedRightBody
    };
    
    const tempNode = {
        type: node.type,
        left: newLeftQuant,
        right: newRightQuant
    };
    
    return pullQuantAtomo(tempNode);
}

function pullQuant(node) {
    if (!node || isAtom(node)) return node;
    
    if (node.left) node.left = pullQuant(node.left);
    if (node.right) node.right = pullQuant(node.right);
    if (node.body) node.body = pullQuant(node.body);
    
    if (node.type === 'e' || node.type === 'ou') {
        return pullQuantAtomo(node);
    }
    
    return node;
}

module.exports = {
    removeImplic,
    removeBicon,
    pushNao,
    removeNaoQuant,
    pullQuant
};