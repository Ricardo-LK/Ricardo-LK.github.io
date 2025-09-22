const { clone } = require('./ast_utils');

let skolemCounter = 0;

// Gera nomes únicos para constantes e funções de Skolem
function freshSkolemName(base = 'f') {
    skolemCounter++;
    return `${base}${skolemCounter}`;
}

// elimina quantificadores existenciais substituindo por funções
function skolemizePrenex(prenexNode) {
    let node = clone(prenexNode);
    let { quantifiers, matrix } = splitPrenex(node);

    let universalVars = [];      // Variáveis universais em escopo
    let mapping = {};            // Mapeamento: variável existencial → função/constante Skolem

    // Substitui variáveis existenciais por suas funções/constantes de Skolem
    function replaceExistentialVars(ast, mapping) {
        if (!ast) return ast;
        
        if (ast.type === 'variavel') {
            if (mapping[ast.name]) {
                return mapping[ast.name];
            }
            return ast;
        }
        
        // Processa argumentos de predicados
        if (ast.type === 'predicado') {
            const args = (ast.args || []).map(a => replaceExistentialVars(a, mapping));
            return { type: 'predicado', name: ast.name, args };
        }
        
        // Processa recursivamente todos os filhos
        let newAst = clone(ast);
        if (newAst.left) newAst.left = replaceExistentialVars(newAst.left, mapping);
        if (newAst.right) newAst.right = replaceExistentialVars(newAst.right, mapping);
        if (newAst.value) newAst.value = replaceExistentialVars(newAst.value, mapping);
        if (newAst.body) newAst.body = replaceExistentialVars(newAst.body, mapping);
        
        return newAst;
    }

    // Processa quantificadores sequencialmente da esquerda para direita
    for (let q of quantifiers) {
        if (q.type === 'paratodos') {
            // Quantificador universal: adiciona variáveis ao escopo
            universalVars.push(...q.vars);
        } else if (q.type === 'existe') {
            // Quantificador existencial: substitui por função/constante de Skolem
            for (let v of q.vars) {
                if (universalVars.length === 0) {
                    // Sem variáveis universais em escopo
                    // ∃x P(x) = P(c1) onde c1 é constante
                    const cname = freshSkolemName('c');
                    mapping[v] = { type: 'predicado', name: cname, args: [] };
                } else {
                    // Com variáveis universais em escopo
                    // ∀x ∃y P(x,y) = ∀x P(x,f1(x)) onde f1 é função
                    const fname = freshSkolemName('f');
                    const args = universalVars.map(u => ({ type: 'variavel', name: u }));
                    mapping[v] = { type: 'predicado', name: fname, args };
                }
            }
        }
    }

    // Aplica todas as substituições na matriz
    let skolemizedMatrix = replaceExistentialVars(clone(matrix), mapping);
    
    return { 
        universalVars: quantifiers.filter(q => q.type === 'paratodos').flatMap(q => q.vars), 
        matrix: skolemizedMatrix 
    };
}

// Separa quantificadores da matriz em fórmulas prenex
function splitPrenex(node) {
    if (!node) {
        return { quantifiers: [], matrix: node };
    }
    
    let quantifiers = [];
    
    // Extrai quantificadores sequenciais do início da fórmula
    function extractQuantifiers(n) {
        if (!n) return n;
        
        if (n.type === 'paratodos' || n.type === 'existe') {
            // Encontrou quantificador: adiciona à lista e processa corpo
            quantifiers.push({
                type: n.type,
                vars: Array.isArray(n.vars) ? n.vars.slice() : [n.vars]
            });
            return extractQuantifiers(n.body);
        }
        
        // Nó não-quantificador 
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
    skolemizePrenex, 
    splitPrenex,
    freshSkolemName 
};