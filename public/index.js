// script.js
document.addEventListener('DOMContentLoaded', function() {
    const logicInput = document.getElementById('logicInput');
    const convertBtn = document.getElementById('convertBtn');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    const dnfResult = document.getElementById('dnfResult');
    const cnfResult = document.getElementById('cnfResult');
    const prenexResult = document.getElementById('prenexResult');

    // Handle form submission
    convertBtn.addEventListener('click', async function() {
        const inputValue = logicInput.value.trim();
        
        if (!inputValue) {
            showError('Por favor, digite uma expressão lógica.');
            return;
        }

        try {
            showLoading(true);
            hideError();
            
            const response = await fetch('http://localhost:3000/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ expression: inputValue })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Update the results
            dnfResult.textContent = data.dnf || 'Erro no processamento';
            cnfResult.textContent = data.cnf || 'Erro no processamento';
            prenexResult.textContent = data.prenex || 'Erro no processamento';

        } catch (error) {
            console.error('Erro:', error);
            showError('Erro ao processar a expressão. Verifique se o servidor está rodando.');
            
            // Reset results on error
            dnfResult.textContent = 'Erro na conversão';
            cnfResult.textContent = 'Erro na conversão';
            prenexResult.textContent = 'Erro na conversão';
        } finally {
            showLoading(false);
        }
    });

    // Allow Enter key to submit
    logicInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            convertBtn.click();
        }
    });

    function showLoading(show) {
        loadingMessage.style.display = show ? 'block' : 'none';
        convertBtn.disabled = show;
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }

    function hideError() {
        errorMessage.style.display = 'none';
    }
});