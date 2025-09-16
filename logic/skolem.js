const { clone, astToString } = require('./ast_utils');

let skolemCounter = 0;

function freshSkolemName(base = 'f') {
    skolemCounter++;
    return `${base}${skolemCounter}`;
}

function skolemizePrenex(prenexNode) {
    let node = clone(prenexNode);
    let { quantifiers, matrix } = splitPrenex(node);

    let universalVars = [];
    let mapping = {};

    function replaceExistentialVars(ast, mapping) {
        if (!ast) return ast;
        
        if (ast.type === 'variavel') {
            if (mapping[ast.name]) {
                return mapping[ast.name];
            }
            return ast;
        }
        
        if (ast.type === 'predicado') {
            const args = (ast.args || []).map(a => replaceExistentialVars(a, mapping));
            return { type: 'predicado', name: ast.name, args };
        }
        
        let newAst = clone(ast);
        if (newAst.left) newAst.left = replaceExistentialVars(newAst.left, mapping);
        if (newAst.right) newAst.right = replaceExistentialVars(newAst.right, mapping);
        if (newAst.value) newAst.value = replaceExistentialVars(newAst.value, mapping);
        if (newAst.body) newAst.body = replaceExistentialVars(newAst.body, mapping);
        
        return newAst;
    }

    for (let q of quantifiers) {
        if (q.type === 'paratodos') {
            universalVars.push(...q.vars);
        } else if (q.type === 'existe') {
            for (let v of q.vars) {
                if (universalVars.length === 0) {
                    // Constante de Skolem
                    const cname = freshSkolemName('c');
                    mapping[v] = { type: 'predicado', name: cname, args: [] };
                } else {
                    // Função de Skolem
                    const fname = freshSkolemName('f');
                    const args = universalVars.map(u => ({ type: 'variavel', name: u }));
                    mapping[v] = { type: 'predicado', name: fname, args };
                }
            }
        }
    }

    let skolemizedMatrix = replaceExistentialVars(clone(matrix), mapping);
    
    return { 
        universalVars: quantifiers.filter(q => q.type === 'paratodos').flatMap(q => q.vars), 
        matrix: skolemizedMatrix 
    };
}

function splitPrenex(node) {
    if (!node) {
        return { quantifiers: [], matrix: node };
    }
    
    let quantifiers = [];
    
    function extractQuantifiers(n) {
        if (!n) return n;
        
        if (n.type === 'paratodos' || n.type === 'existe') {
            quantifiers.push({
                type: n.type,
                vars: Array.isArray(n.vars) ? n.vars.slice() : [n.vars]
            });
            return extractQuantifiers(n.body);
        }
        
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