function lexer(proposicao) {
    const tokensRegex = [
        { type: "paratodos", pattern: /∀|forall/ },
        { type: "existe", pattern: /∃|exists/ },
        { type: "implicacao", pattern: /→|->|=>/ },
        { type: "bicondicional", pattern: /↔|<->|<=>/ },
        { type: "e", pattern: /∧|&|and/ },
        { type: "ou", pattern: /∨|\||or/ },
        { type: "nao", pattern: /¬|~|not/ },
        { type: "eparen", pattern: /\(/ },
        { type: "dparen", pattern: /\)/ },
        { type: "virgula", pattern: /,/ },
        { type: "variavel", pattern: /[a-z]/ },
        { type: "predicado", pattern: /[A-Z]/ },
        { type: "espaco", pattern: /\s+/ }
    ];

    let tokens = [];
    let inputBuffer = proposicao;

    while (inputBuffer.length > 0) {
        let tokenEncontrado = false;

        for (let { type, pattern } of tokensRegex) {
            let match = pattern.exec(inputBuffer);
            if (match && match.index === 0) {
                if (type != "espaco") tokens.push({type, value: match[0]});
                inputBuffer = inputBuffer.substring(match[0].length);
                tokenEncontrado = true;
                break;
            }
        }

        if (!tokenEncontrado) inputBuffer = inputBuffer.substring(1);
    }

    tokens.push({type: "EOF", value: ""});
    return tokens;
}

module.exports = { lexer };