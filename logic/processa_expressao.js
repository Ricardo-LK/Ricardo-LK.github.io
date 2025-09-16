let { lexer } = require('./lexer');
let { parser } = require('./parser');
let { clone, astToString } = require('./ast_utils');
let { removeImplic, removeBicon, pushNao, removeNaoQuant, pullQuant } = require('./prenex');
let { skolemizePrenex } = require('./skolem');
let { toCNFMatrix, toDNFMatrix, collectClauses, isHornClause } = require('./cnf_dnf');


function processLatex(input) {
    if (!input || typeof input !== 'string') return input;

    let s = input.trim();
    s = s.replace(/^\$+|\$+$/g, '');
    s = s.replace(/\\\(|\\\)/g, '');
    s = s.replace(/\\\[|\\\]/g, '');
    s = s.replace(/\\,|\\;|\\:|\\quad|\\qquad/g, ' ');
    s = s.replace(/\\forall\b/g, '∀');
    s = s.replace(/\\exists\b/g, '∃');
    s = s.replace(/\\neg\b|\\lnot\b|\\not\b/g, '¬');
    s = s.replace(/\\land\b|\\wedge\b/g, '∧');
    s = s.replace(/\\lor\b|\\vee\b/g, '∨');
    s = s.replace(/\\rightarrow\b|\\to\b|\\Rightarrow\b|\\implies\b/g, '→');
    s = s.replace(/\\leftrightarrow\b|\\iff\b|\\Leftrightarrow\b/g, '↔');
    s = s.replace(/->|=>|\\to/g, '→');
    s = s.replace(/<->|<=>/g, '↔');
    s = s.replace(/\\left\s*\(/g, '(');
    s = s.replace(/\\right\s*\)/g, ')');
    s = s.replace(/[{}]/g, '');
    s = s.replace(/\\[a-zA-Z]+/g, '');
    s = s.replace(/\s+/g, ' ');
    return s.trim();
}

function processExpression(expression) {
    let pre = processLatex(expression);
    let tokens = lexer(pre);
    let ast = parser(tokens);

    // Passos para prenex
    let s0 = clone(ast);
    let s1 = removeImplic(clone(s0));
    let s2 = removeBicon(clone(s1));
    let s3 = pushNao(clone(s2));
    let s4 = removeNaoQuant(clone(s3));
    let s5 = pullQuant(clone(s4));

    let prenex = clone(s5);
    const prenexString = astToString(prenex);

    // Skolemização
    const sk = skolemizePrenex(prenex);
    const skolemMatrix = sk.matrix;
    const universalVars = sk.universalVars;

    // CNF e DNF
    let cnfMatrix = toCNFMatrix(skolemMatrix);
    let dnfMatrix = toDNFMatrix(skolemMatrix);

    // Forma clausal
    let clauses = collectClauses(cnfMatrix);
    let clausesStrings = clauses.map(clauseToString);
    let hornFlags = clauses.map(isHornClause);

    return {
        prenex_steps: [astToString(s1), astToString(s2), astToString(s3), astToString(s4), astToString(s5)],
        prenex: prenexString,
        skolemization: {
            universal_vars: universalVars,
            matrix_after_skolem: astToString(skolemMatrix)
        },
        prenex_cnf: {
            quantifiers: universalVars,
            matrix: astToString(cnfMatrix)
        },
        prenex_dnf: {
            quantifiers: universalVars,
            matrix: astToString(dnfMatrix)
        },
        clausal_form: clausesStrings,
        horn_clause_flags: hornFlags
    };
}

function clauseToString(clause) {
    return clause.map(l => (l.neg ? '¬' : '') + astToString(l.atom)).join(' ∨ ');
}

module.exports = { processExpression };