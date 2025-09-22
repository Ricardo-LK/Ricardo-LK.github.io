function parser(tokens) {  
    let i = 0; // Índice atual na array de tokens

    function peek() {
        return tokens[i] ? tokens[i] : { type: "EOF", value: "" };
    }

    function next(expectedType) {                          
        if (tokens[i] && tokens[i].type === expectedType) {
            let atual = tokens[i];
            i++;
            return atual;
        }                
    }

    // Ponto de entrada: inicia com maior precedência
    function parseFormula() { return parseBicon(); }

    // Bicondicional (menor precedência)
    function parseBicon() {
        let left = parseImplic();

        while (peek().type === 'bicondicional') {
            next('bicondicional');
            let right = parseImplic();
            left = { type: 'bicondicional', left, right }; // Associatividade à esquerda
        }

        return left;
    }

    // Implicação
    function parseImplic() {
        let left = parseOu();

        while (peek().type === 'implicacao') {
            next('implicacao');
            let right = parseOu();
            left = { type: 'implicacao', left, right };
        }

        return left;
    }

    // Disjunção (OU)
    function parseOu() {
        let left = parseE();

        while (peek().type === 'ou') {
            next('ou');
            let right = parseE();
            left = { type: 'ou', left, right };
        }

        return left;
    }

    // Conjunção (E) 
    function parseE() {
        let left = parseAtomo();

        while (peek().type === 'e') {
            next('e');
            let right = parseAtomo();
            left = { type: 'e', left, right };
        }

        return left;
    }

    // Átomos: negação, quantificadores, parênteses, predicados, variáveis
    function parseAtomo() {
        let t = peek();

        // Negação
        if (t.type === 'nao') {
            next('nao');
            let value = parseAtomo(); // Permite encadeamento de negações
            return { type: 'nao', value };
        }

        // Quantificadores universais e existenciais
        if (t.type === 'paratodos' || t.type === 'existe') {
            let quantType = t.type;
            next(quantType);
            let vars = parseVariavel(); // Lista de variáveis quantificadas
            let body = parseFormula();  // Corpo do quantificador
            return { type: quantType, vars, body };
        }

        // Parênteses - agrupa expressões
        if (t.type === 'eparen') {
            next('eparen');
            let body = parseFormula();
            next('dparen');
            return body; // Parênteses não criam nó AST extra
        }

        // Predicado com ou sem argumentos
        if (t.type === 'predicado') {
            let name = next('predicado').value;

            if (peek().type === 'eparen') {
                next('eparen');
                let args = parsePredicado(); // Lista de argumentos
                next('dparen');
                return { type: 'predicado', name, args };
            }

            return { type: 'predicado', name, args: [] }; // Predicado sem argumentos
        }

        // Variável simples
        if (t.type === 'variavel') {
            let name = next('variavel').value;
            return { type: 'variavel', name };
        }
    }

    // Parseia lista de variáveis separadas por vírgula (para quantificadores)
    function parseVariavel() {
        let vars = [];
        let proximo = peek();

        if (proximo.type != 'variavel') {
            throw new Error(`Esperado 'variavel', encontrado '${proximo.type}'`);
        }
        
        vars.push(next('variavel').value);
        
        while (peek().type === 'virgula') {
            next('virgula');
            vars.push(next('variavel').value);
        }

        return vars;
    }

    // Parseia argumentos de predicados (termos separados por vírgula)
    function parsePredicado() {
        let terms = [];
        
        if (peek().type === 'dparen') return terms; // Lista vazia

        // Caso 1: argumentos são variáveis simples
        if (peek().type === 'variavel') {
            terms.push({ type: 'variavel', name: next('variavel').value });

            while (peek().type === 'virgula') {
                next('virgula');
                terms.push({ type: 'variavel', name: next('variavel').value });
            }

            return terms;
        }

        // Caso 2: argumentos são predicados aninhados
        if (peek().type === 'predicado') {
            let atom = parseAtomo();
            terms.push(atom);

            while (peek().type === 'virgula') {
                next('virgula');
                terms.push(parseAtomo());
            }
            
            return terms;
        }

        return terms;
    }

    // Constrói AST completa e verifica se todos os tokens foram consumidos
    let ast = parseFormula();
    
    if (peek().type != 'EOF') {
        throw new Error(`Token inesperado: ${peek().type} (${peek().value})`);
    }

    return ast;
}

module.exports = { parser };