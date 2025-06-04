document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById('chat-box');
    const optionCardsDiv = document.getElementById('option-cards');
    const sendBtn = document.getElementById('send-btn');
    const skipBtn = document.getElementById('skip-btn');
    const backBtn = document.getElementById('back-btn');
    const startBtn = document.getElementById('start-btn');
    const progressBarSteps = document.getElementById('progress-bar-steps');
    const typingIndicator = document.getElementById('typing-indicator');

    // Questionnaire state
    let questionFlow = [
        {key: "fabric", label: "What fabric do you prefer?", options: []},
        {key: "occasion", label: "Is this for a specific occasion?", options: []},
        {key: "neckline", label: "Any preferred neckline style?", options: []},
        {key: "sleeve", label: "What sleeve style do you like?", options: []}
    ];
    let optionsFromBackend = {};
    let currentStep = 0;
    let criteria = {};
    let selectedOption = null;
    let answers = [];

    // Cart/order state
    let cart = [];
    let orderingBlouse = null;
    let orderStep = 0;
    let orderData = { name: "", phone: "", address: "" };
    let checkoutQueue = [];

    // Helper: Append message
    function appendMessage(content, sender = 'bot') {
        const div = document.createElement('div');
        div.className = 'message ' + sender;
        div.innerHTML = content;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Progress bar
    function renderProgressBar(step) {
        progressBarSteps.innerHTML = '';
        questionFlow.forEach((q, idx) => {
            const el = document.createElement('div');
            el.className = 'progress-step' + (idx === step ? ' active' : '');
            el.textContent = (idx + 1) + '. ' + q.key.charAt(0).toUpperCase() + q.key.slice(1);
            progressBarSteps.appendChild(el);
        });
    }

    // Show options as cards/tiles (CORRECTED: use backend value for logic, pretty label for display)
    function showQuestion(step) {
        if (step >= questionFlow.length) return;
        let q = questionFlow[step];
        optionCardsDiv.innerHTML = '';
        selectedOption = null;
        sendBtn.style.display = "none";
        skipBtn.style.display = "";
        backBtn.style.display = step > 0 ? "" : "none";
        renderProgressBar(step);
        appendMessage(`<b>${q.label}</b>`, 'bot');
        q.options.forEach(opt => {
            let card = document.createElement('div');
            card.className = 'option-card';
            // Show prettified label, but keep the actual value for logic
            card.textContent = opt.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            card.dataset.value = opt; // Store the backend value
            card.onclick = function () {
                document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedOption = card.dataset.value; // Use the backend value
                sendBtn.style.display = "";
            };
            optionCardsDiv.appendChild(card);
        });
    }

    // Start questionnaire
    startBtn.onclick = async function () {
        chatBox.innerHTML = '';
        optionCardsDiv.innerHTML = '';
        criteria = {};
        answers = [];
        currentStep = 0;
        startBtn.style.display = "none";
        sendBtn.style.display = "none";
        skipBtn.style.display = "none";
        backBtn.style.display = "none";
        appendMessage("<b>👋 Hi! Let's find your perfect blouse. Please answer a few quick questions.</b>", 'bot');
        // Get options from backend
        const res = await fetch('/api/questionnaire_options');
        optionsFromBackend = await res.json();
        questionFlow.forEach(q => {
            q.options = optionsFromBackend[q.key] || [];
        });
        showQuestion(currentStep);
    };

    // Send answer (CORRECTED: use backend value for logic, pretty label for display)
    sendBtn.onclick = async function (e) {
        e.preventDefault();
        if (!selectedOption) return;
        let q = questionFlow[currentStep];
        // Display the prettified value to the user
        appendMessage(selectedOption.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 'user');
        criteria[q.key] = selectedOption; // Always send the backend value!
        answers.push({label: q.label, value: selectedOption});
        currentStep++;
        if (currentStep < questionFlow.length) {
            showQuestion(currentStep);
        } else {
            showSummary();
        }
    };

    // Skip answer
    skipBtn.onclick = function () {
        let q = questionFlow[currentStep];
        appendMessage("<i>Skipped</i>", 'user');
        criteria[q.key] = "";
        answers.push({label: q.label, value: "Skipped"});
        currentStep++;
        if (currentStep < questionFlow.length) {
            showQuestion(currentStep);
        } else {
            showSummary();
        }
    };

    // Go back to previous question
    backBtn.onclick = function () {
        if (currentStep > 0) {
            currentStep--;
            answers.pop();
            showQuestion(currentStep);
        }
    };

    // Show summary of answers before submission
    function showSummary() {
        optionCardsDiv.innerHTML = '';
        sendBtn.style.display = "none";
        skipBtn.style.display = "none";
        backBtn.style.display = "none";
        renderProgressBar(questionFlow.length - 1);
        let html = `<b>Here's a summary of your answers:</b><ul style="margin:10px 0 10px 18px;">`;
        answers.forEach(a => {
            html += `<li><b>${a.label}:</b> ${a.value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</li>`;
        });
        html += `</ul><div style="margin-top:10px;">Searching for your perfect blouse...</div>`;
        appendMessage(html, 'bot');
        typingIndicator.style.display = "";
        fetch('/api/questionnaire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(criteria)
        })
        .then(res => res.json())
        .then(data => {
            typingIndicator.style.display = "none";
            // Always show suggestions, fallback to showing top products if needed
            if (data.results && data.results.length > 0) {
                showSuggestions(data.results);
            } else {
                appendMessage("Here are some popular blouses you might like:", 'bot');
                showSuggestions([]);
            }
            startBtn.style.display = "";
            startBtn.textContent = "Restart";
        });
    }

    // Show blouse suggestions with Add to Cart / Buy Now
    function showSuggestions(results) {
        optionCardsDiv.innerHTML = '';
        let html = `<b>Here are your best matches:</b>`;
        if (!results || results.length === 0) {
            html += `<div class="message bot" style="margin-top:12px;">Sorry, no products found in our database.</div>`;
            appendMessage(html, 'bot');
            return;
        }
        results.forEach((item, idx) => {
            html += `
                <div class="suggestion-card" style="margin-bottom:18px; padding:16px; border-radius:16px; background:#f3f6fc; box-shadow:0 2px 8px rgba(37,99,235,0.08);">
                    <div style="font-size:1.12rem;font-weight:600;color:#1e293b;">${item.title}</div>
                    <div style="color:#64748b; font-size:0.96rem; margin-bottom:6px;">ID: ${item.design_id}</div>
                    <div style="margin-bottom:6px;">
                        <span style="color:#2563eb;font-weight:600;">₹${item.price_inr || 'N/A'}</span>
                    </div>
                    <div style="margin-bottom:4px;">
                        <b>Fabric:</b> ${Array.isArray(item.fabric) ? item.fabric.join(', ') : item.fabric || 'N/A'}
                    </div>
                    <div style="margin-bottom:4px;">
                        <b>Neckline:</b> ${item.neckline || 'N/A'} &nbsp;|&nbsp; <b>Sleeve:</b> ${item.sleeve || 'N/A'}
                    </div>
                    <div style="margin-bottom:4px;">
                        <b>Occasion:</b> ${Array.isArray(item.occasion_tags) ? item.occasion_tags.join(', ') : 'N/A'}
                    </div>
                    ${item.front_image_url ? `<img src="${item.front_image_url}" alt="blouse" style="max-width:150px; border-radius:12px; margin:10px 0 0 0; box-shadow:0 4px 12px rgba(37,99,235,0.10);">` : ''}
                    <div style="margin-top:10px;">
                        <button class="send-btn add-cart-btn" data-idx="${idx}" style="margin-right:10px;">Add to Cart</button>
                        <button class="send-btn buy-now-btn" data-idx="${idx}">Buy Now</button>
                    </div>
                </div>
            `;
        });
        appendMessage(html, 'bot');
        setTimeout(() => {
            results.forEach((item, idx) => {
                document.querySelector(`.add-cart-btn[data-idx="${idx}"]`).onclick = () => addToCart(item);
                document.querySelector(`.buy-now-btn[data-idx="${idx}"]`).onclick = () => startOrderProcess(item);
            });
        }, 100);
    }

    // --- Cart/order logic (shared with chat) ---
    function addToCart(item) {
        if (!cart.find(b => b.design_id === item.design_id)) {
            cart.push(item);
            appendMessage(`✅ <b>${item.title}</b> added to cart! 🛒`, 'bot');
        } else {
            appendMessage(`ℹ️ <b>${item.title}</b> is already in your cart.`, 'bot');
        }
    }

    function startOrderProcess(item) {
        orderingBlouse = item;
        orderStep = 1;
        orderData = { name: "", phone: "", address: "" };
        appendMessage("Great! Let's place your order. What's your full name?", 'bot');
        optionCardsDiv.innerHTML = '';
    }

    async function handleOrderInput(input) {
        appendMessage(input, 'user');
        switch(orderStep) {
            case 1:
                orderData.name = input;
                orderStep = 2;
                appendMessage("Thank you! Please provide your phone number.", 'bot');
                break;
            case 2:
                orderData.phone = input;
                orderStep = 3;
                appendMessage("Finally, please provide your delivery address.", 'bot');
                break;
            case 3:
                orderData.address = input;
                await submitOrder();
                break;
        }
    }

    async function submitOrder() {
        appendMessage("Processing your order...", 'bot');
        try {
            const response = await fetch('/api/place_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: orderData.name,
                    phone: orderData.phone,
                    address: orderData.address,
                    products: [orderingBlouse]
                })
            });
            const data = await response.json();
            if (data.success) {
                appendMessage(`✅ Order placed for <b>${orderingBlouse.title}</b>!<br>Total Amount: <b>₹${orderingBlouse.price_inr || 'N/A'}</b><br>Thank you ${orderData.name}. We'll contact you at ${orderData.phone}.`, 'bot');
                cart = cart.filter(b => b.design_id !== orderingBlouse.design_id);
            } else {
                appendMessage(`❌ Order failed: ${data.message}`, 'bot');
            }
        } catch (error) {
            appendMessage("⚠️ Error processing order. Please try again.", 'bot');
        }
        resetOrderState();
    }

    function resetOrderState() {
        orderingBlouse = null;
        orderStep = 0;
        orderData = { name: "", phone: "", address: "" };
    }

    // --- Chat input for order flow ---
    chatBox.addEventListener('keydown', function (e) {
        if (orderingBlouse && e.target.classList.contains('chat-input') && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleOrderInput(e.target.value.trim());
            e.target.value = '';
        }
    });
});
