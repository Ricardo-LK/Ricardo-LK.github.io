let express = require('express');
let cors = require('cors');
let path = require('path');

let app = express();
let PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Import das dependência
let { processExpression } = require('./logic/processa_expressao');

// Rota de processamento
app.post('/process', (req, res) => {
    try {
        let { expression } = req.body;
        if (!expression) {
            return res.status(400).json({ error: 'Expression is required' });
        }

        const result = processExpression(expression);
        res.json(result);

    } catch (error) {   
        console.error('Erro de processamento:', error);
        res.status(500).json({ error: 'Erro interno do servidor durante o processamento', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor executando em http://localhost:${PORT}`);
    console.log('Endpoints:');
    console.log(`  POST http://localhost:${PORT}/process - Processa expressões lógicas`);
});

module.exports = app;