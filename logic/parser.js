function parser(tokens) {
    let i = 0;

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

    function parseFormula() { return parseBicon(); }
    
    function parseBicon() {
        let left = parseImplic();

        while (peek().type === 'bicondicional') {
            next('bicondicional');
            let right = parseImplic();
            left = { type: 'bicondicional', left, right };
        }

        return left;
    }
    
    function parseImplic() {
        let left = parseOu();

        while (peek().type === 'implicacao') {
            next('implicacao');
            let right = parseOu();
            left = { type: 'implicacao', left, right };
        }

        return left;
    }

    function parseOu() {
        let left = parseE();

        while (peek().type === 'ou') {
            next('ou');
            let right = parseE();
            left = { type: 'ou', left, right };
        }

        return left;
    }

    function parseE() {
        let left = parseAtomo();

        while (peek().type === 'e') {
            next('e');
            let right = parseAtomo();
            left = { type: 'e', left, right };
        }

        return left;
    }

    function parseAtomo() {
        let t = peek();

        // Não
        if (t.type === 'nao') {
            next('nao');
            let value = parseAtomo();
            return { type: 'nao', value };
        }

        // Paratodo/Existe
        if (t.type === 'paratodos' || t.type === 'existe') {
            let quantType = t.type;
            next(quantType);
            let vars = parseVariavel();
            let body = parseFormula();
            return { type: quantType, vars, body };
        }

        // Trata parênteses
        if (t.type === 'eparen') {
            next('eparen');
            let body = parseFormula();
            next('dparen');
            return body;
        }

        // Predicado
        if (t.type === 'predicado') {
            let name = next('predicado').value;

            if (peek().type === 'eparen') {
                next('eparen');
                let args = parsePredicado();
                next('dparen');
                return { type: 'predicado', name, args };
            }

            return { type: 'predicado', name, args: [] };
        }

        // Variável
        if (t.type === 'variavel') {
            let name = next('variavel').value;
            return { type: 'variavel', name };
        }
    }

    function parseVariavel() {
        let vars = [];
        let proximo = peek();

        if (proximo.type != 'variavel') {
            throw new Error(`Tipo errado: ${proximo.type} em variavel`);
        }
        
        vars.push(next('variavel').value);
        while (peek().type === 'virgula') {
            next('virgula');
            vars.push(next('variavel').value);
        }

        return vars;
    }

    function parsePredicado() {
        let terms = [];
        if (peek().type === 'dparen') return terms;

        if (peek().type === 'variavel') {
            terms.push({ type: 'variavel', name: next('variavel').value });

            while (peek().type === 'virgula') {
                next('virgula');
                terms.push({ type: 'variavel', name: next('variavel').value });
            }

            return terms;
        }

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

    let ast = parseFormula();
    if (peek().type != 'EOF') {
        throw new Error(`Input desconhecido: ${peek().type} (${peek().value})`);
    }

    return ast;
}

module.exports = { parser };