const { clone, isAtom, renameVar, hasFreeVar, substitute, isQuant, arraysEqual } = require('./ast_utils');

// Remove implicações: A → B vira ¬A ∨ B
function removeImplic(node) {
    if (!node || isAtom(node)) return node;

    // Processa recursivamente todos os filhos
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

// Remove bicondicionais: A ↔ B vira (¬A ∨ B) ∧ (¬B ∨ A)
function removeBicon(node) {
    if (!node || isAtom(node)) return node;

    // Processa recursivamente todos os filhos
    if (node.left) node.left = removeBicon(node.left);
    if (node.right) node.right = removeBicon(node.right);
    if (node.body) node.body = removeBicon(node.body);
    if (node.value) node.value = removeBicon(node.value);

    if (node.type === 'bicondicional') {
        let l = clone(node.left);
        let r = clone(node.right);
        return {
            type: 'e',
            left: { type: 'ou', left: { type: 'nao', value: l }, right: r },
            right: { type: 'ou', left: { type: 'nao', value: r }, right: l }
        };
    }
    
    return node;
}

// Aplica leis de De Morgan e elimina duplas negações
function pushNao(node) {
    if (!node) return node;

    if (node.type === 'nao') {
        let v = node.value;
        if (v.type === 'nao') return pushNao(v.value); // ¬¬A = A
        
        // Lei de De Morgan: ¬(A ∧ B) = ¬A ∨ ¬B
        if (v.type === 'e') return { 
            type: 'ou', 
            left: pushNao({ type: 'nao', value: v.left }), 
            right: pushNao({ type: 'nao', value: v.right }) 
        };
        
        // Lei de De Morgan: ¬(A ∨ B) = ¬A ∧ ¬B
        if (v.type === 'ou') return { 
            type: 'e', 
            left: pushNao({ type: 'nao', value: v.left }), 
            right: pushNao({ type: 'nao', value: v.right }) 
        };
    }

    // Processa recursivamente todos os filhos
    let result = { ...node };
    if (node.left) result.left = pushNao(node.left);
    if (node.right) result.right = pushNao(node.right);
    if (node.body) result.body = pushNao(node.body);
    if (node.value) result.value = pushNao(node.value);
    
    return result;
}

// Remove negações de quantificadores: ¬∀x vira ∃x¬, ¬∃x vira ∀x¬
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

    // Processa recursivamente todos os filhos
    if (node.left) node.left = removeNaoQuant(node.left);
    if (node.right) node.right = removeNaoQuant(node.right);
    if (node.body) node.body = removeNaoQuant(node.body);
    if (node.value) node.value = removeNaoQuant(node.value);

    return node;
}

// Puxa quantificadores para fora de operações lógicas
function pullQuantAtomo(node) {
    if (!node || !node.left || !node.right) return node;
    
    node.left = pullQuantAtomo(node.left);
    node.right = pullQuantAtomo(node.right);
    
    // Mesmo tipo e variáveis: combina quantificadores
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
    
    // Apenas lado esquerdo é quantificador
    if (isQuant(node.left) && !isQuant(node.right)) {
        return substituteQuantLeft(node);
    }
    
    // Apenas lado direito é quantificador
    if (!isQuant(node.left) && isQuant(node.right)) {
        return substituteQuantRight(node);
    }
    
    // Ambos os lados são quantificadores
    if (isQuant(node.left) && isQuant(node.right)) {
        return substituteQuants(node);
    }
    
    return node;
}

// Move quantificador do lado esquerdo para fora
function substituteQuantLeft(node) {
    const quantVar = node.left.vars[0];
    const quantType = node.left.type;
    
    if (!hasFreeVar(node.right, quantVar)) {
        // Variável não ocorre livre no lado direito
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
        // Renomeia para evitar captura de variável
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

// Move quantificador do lado direito para fora
function substituteQuantRight(node) {
    const quantVar = node.right.vars[0];
    const quantType = node.right.type;
    
    if (!hasFreeVar(node.left, quantVar)) {
        // Variável não ocorre livre no lado esquerdo
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
        // Renomeia para evitar captura de variável
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

// Trata caso onde ambos os lados têm quantificadores
function substituteQuants(node) {
    // Tenta mover quantificador esquerdo primeiro
    let tempNode = substituteQuantLeft(node);
    
    // Se não mudou, tenta lado direito
    if (tempNode === node) {
        tempNode = substituteQuantRight(node);
    }
    
    // Se ainda não mudou, processa ambos os lados
    if (tempNode === node) {
        return substituteQuantLeftERight(node);
    }
    
    return pullQuantAtomo(tempNode);
}

// Renomeia variáveis em ambos os quantificadores para evitar conflitos
function substituteQuantLeftERight(node) {
    const leftVar = node.left.vars[0];
    const rightVar = node.right.vars[0];
    const leftType = node.left.type;
    const rightType = node.right.type;
    
    // Gera novos nomes para evitar captura
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

// Função principal: puxa todos os quantificadores para fora
function pullQuant(node) {
    if (!node || isAtom(node)) return node;
    
    // Processa recursivamente todos os filhos primeiro
    if (node.left) node.left = pullQuant(node.left);
    if (node.right) node.right = pullQuant(node.right);
    if (node.body) node.body = pullQuant(node.body);
    
    // Aplica transformação apenas em operações lógicas
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