document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');
    hljs.highlightAll();
    const elements = {
        chatBox: document.getElementById('chat-box'),
        fileInput: document.getElementById('file-input'),
        filePreview: document.getElementById('file-preview'),
        chatInput: document.getElementById('chat-input'),
        sendButton: document.getElementById('send-button'),
        voiceInputButton: document.getElementById('voice-input'),
        themeToggle: document.getElementById('theme-toggle'),
        scrollToBottomButton: document.getElementById('scroll-to-bottom'),
        uploadProgressBar: document.getElementById('upload-progress-bar')
    };

    let selectedFile = null;
    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];
    const messageChunks = {};
    const messageElements = {};
    let currentStreamingMessageId = null;

    const socket = io('http://localhost:3000');

    socket.on('connect', () => console.log('Successfully connected to WebSocket server'));
    socket.on('connect_error', (error) => console.error('WebSocket connection error:', error));

    socket.on('ai-response', ({ messageId, chunkText, done }) => {
        if (messageId !== currentStreamingMessageId) {
            currentStreamingMessageId = messageId;
            messageChunks[messageId] = '';
            appendMessage('bot', '', messageId);
        }
        console.log(`Received AI response chunk for message ${messageId}`);

        messageChunks[messageId] += chunkText;
        const cursorEffect = done ? '' : '<span class="blinking-cursor">▋</span>';
        updateMessageContent(messageId, messageChunks[messageId] + cursorEffect);

        if (done) {
            currentStreamingMessageId = null;
            console.log(`Completed AI response for message ${messageId}`);
        }
    });

    // Load saved theme
    if (localStorage.getItem('theme') === 'dark') {
        toggleDarkMode();
    }
    console.log('Theme loaded from localStorage');

    elements.chatBox.addEventListener('dragover', handleDragOver);
    elements.chatBox.addEventListener('drop', handleDrop);
    elements.fileInput.addEventListener('change', handleFileInputChange);
    elements.sendButton.addEventListener('click', sendMessage);
    elements.chatInput.addEventListener('keydown', handleChatInputKeydown);
    elements.voiceInputButton.addEventListener('click', toggleRecording);
    elements.themeToggle.addEventListener('click', toggleDarkMode);
    elements.chatBox.addEventListener('scroll', handleChatBoxScroll);
    elements.scrollToBottomButton.addEventListener('click', scrollToBottom);

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        console.log('File drag over chat box');
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('File dropped in chat box');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelection(files[0]);
        }
    }

    function handleFileInputChange(event) {
        const file = event.target.files[0];
        if (file) {
            console.log('File selected via input:', file.name);
            handleFileSelection(file);
        }
    }

    function handleFileSelection(file) {
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxFileSize) {
            alert(`File size exceeds 10MB limit. Please choose a smaller file.`);
            console.warn('File size limit exceeded:', file.name, file.size);
            return;
        }

        const allowedTypes = ['image/', 'video/', 'audio/', 'application/pdf', 'text/'];
        if (!allowedTypes.some(type => file.type.startsWith(type))) {
            alert(`File type not supported. Please choose an image, video, audio, PDF, or text file.`);
            console.warn('Unsupported file type:', file.name, file.type);
            return;
        }

        selectedFile = file;
        previewFile(file);
        appendMessage('user', `[File uploaded: ${file.name}]`);
        console.log('File processed and previewed:', file.name);
    }

    function previewFile(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            if (file.type.startsWith('image/')) {
                elements.filePreview.innerHTML = `<img src="${e.target.result}" alt="File preview" style="max-height: 100px;">`;
            } else if (file.type.startsWith('video/')) {
                elements.filePreview.innerHTML = `<video src="${e.target.result}" controls style="max-height: 100px;"></video>`;
            } else if (file.type.startsWith('audio/')) {
                elements.filePreview.innerHTML = `<audio src="${e.target.result}" controls></audio>`;
            } else {
                elements.filePreview.innerHTML = `<span>${file.name}</span>`;
            }
        };
        reader.readAsDataURL(file);
    }

    async function sendMessage() {
        const messageText = elements.chatInput.value.trim();
        if (!messageText && !selectedFile) return;
        console.log('Sending message:', messageText ? messageText : 'File only');

        appendMessage('user', messageText);
        const formData = new FormData();
        formData.append('message', messageText);
        if (selectedFile) {
            formData.append('file', selectedFile);
        }

        try {
            await fetchWithErrorHandling('/api/chat', {
                method: 'POST',
                body: formData
            });
            resetInput();
        } catch (error) {
            console.error('Error in sendMessage:', error.message);
            appendMessage('bot', 'An error occurred while sending the message. Please try again.');
        }
    }

    function resetInput() {
        elements.chatInput.value = '';
        elements.filePreview.innerHTML = '';
        selectedFile = null;
        console.log('Input reset after sending message');
    }

    function appendMessage(sender, content, messageId = null) {
        let messageDiv = messageId && messageElements[messageId] 
            ? messageElements[messageId] 
            : document.createElement('div');

        if (!messageId || !messageElements[messageId]) {
            messageId = messageId || Date.now().toString();
            messageDiv.className = `message ${sender}`;
            messageDiv.setAttribute('data-id', messageId);
            messageElements[messageId] = messageDiv;
            elements.chatBox.appendChild(messageDiv);
        }

        const contentDiv = messageDiv.querySelector('.message-content') || document.createElement('div');
        contentDiv.className = 'message-content';
        if (content.startsWith('[File uploaded:')) {
            const fileName = content.match(/\[File uploaded: (.*?)\]/)[1];
            contentDiv.innerHTML = `<div class="file-message">
                <i class="fas fa-file"></i>
                <span>${fileName}</span>
            </div>`;
        } else {
            contentDiv.innerHTML = DOMPurify.sanitize(marked.parse(content, {
                highlight: function(code, lang) {
                    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                    return hljs.highlight(code, { language }).value;
                }
            }));
            contentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightBlock(block);
            });
        }

        if (!messageDiv.querySelector('.message-content')) {
            messageDiv.appendChild(contentDiv);
        }

        const timestampDiv = messageDiv.querySelector('.timestamp') || document.createElement('div');
        timestampDiv.className = 'timestamp';
        timestampDiv.textContent = new Date().toLocaleTimeString();

        if (!messageDiv.querySelector('.timestamp')) {
            messageDiv.appendChild(timestampDiv);
        }

        scrollToBottom();
        console.log(`Message appended: ${sender}, ID: ${messageId}`);
    }

    function updateMessageContent(messageId, content) {
        const messageDiv = messageElements[messageId];
        if (messageDiv) {
            const contentDiv = messageDiv.querySelector('.message-content') || messageDiv;
            contentDiv.innerHTML = DOMPurify.sanitize(marked.parse(content, {
                highlight: function(code, lang) {
                    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                    return hljs.highlight(code, { language }).value;
                }
            }));
            contentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightBlock(block);
            });
            scrollToBottom();
            console.log(`Message content updated: ID ${messageId}`);
        }
    }

    function scrollToBottom() {
        if (elements.chatBox.scrollTop + elements.chatBox.clientHeight >= elements.chatBox.scrollHeight - 100) {
            elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
        }
        console.log('Scrolled to bottom of chat');
    }

    function handleChatInputKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    }

    async function toggleRecording() {
        if (isRecording) {
            stopRecording();
        } else {
            await startRecording();
        }
    }

    async function startRecording() {
        console.log('Attempting to start audio recording');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };
            mediaRecorder.onstop = sendAudioToServer;
            mediaRecorder.start();
            isRecording = true;
            elements.voiceInputButton.classList.add('recording');
            console.log('Audio recording started');
        } catch (error) {
            console.error('Error accessing microphone:', error.message);
        }
    }

    function stopRecording() {
        if (mediaRecorder) {
            mediaRecorder.stop();
            isRecording = false;
            elements.voiceInputButton.classList.remove('recording');
            console.log('Audio recording stopped');
        }
    }

    async function sendAudioToServer() {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.wav');
        console.log('Sending audio for transcription');

        try {
            const data = await fetchWithErrorHandling('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            elements.chatInput.value = data.transcription;
            console.log('Audio transcription received');
        } catch (error) {
            console.error('Error transcribing audio:', error.message);
        } finally {
            audioChunks = [];
        }
    }

    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        localStorage.setItem('theme', currentTheme);
        console.log('Theme toggled:', currentTheme);
    }

    function handleChatBoxScroll() {
        elements.scrollToBottomButton.style.display = 
            elements.chatBox.scrollTop < elements.chatBox.scrollHeight - elements.chatBox.clientHeight - 100 ? 'flex' : 'none';
    }

    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

    async function uploadInChunks(formData) {
        const file = formData.get('file');
        if (!file) {
            return sendTextOnlyMessage(formData);
        }

        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        for (let start = 0; start < file.size; start += CHUNK_SIZE) {
            const chunk = file.slice(start, start + CHUNK_SIZE);
            const chunkFormData = new FormData();
            chunkFormData.append('file', chunk, file.name);
            chunkFormData.append('chunkIndex', Math.floor(start / CHUNK_SIZE));
            chunkFormData.append('totalChunks', totalChunks);

            await fetchWithErrorHandling('/api/upload-chunk', {
                method: 'POST',
                body: chunkFormData
            });
            console.log(`Chunk ${Math.floor(start / CHUNK_SIZE) + 1}/${totalChunks} uploaded`);

            updateUploadProgress((start + chunk.size) / file.size * 100);
        }

        await fetchWithErrorHandling('/api/complete-upload', {
            method: 'POST',
            body: JSON.stringify({ fileName: file.name, totalChunks }),
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('File upload completed:', file.name);

        return sendTextOnlyMessage(formData);
    }

    async function sendTextOnlyMessage(formData) {
        return fetchWithErrorHandling('/api/chat', {  // Changed from '/api/send-message' to '/api/chat'
            method: 'POST',
            body: formData
        }).then(() => {
            console.log('Text-only message sent successfully');
        });
    }

    async function fetchWithErrorHandling(url, options) {
        try {
            const response = await fetch(`http://localhost:3000${url}`, options);
            if (!response.ok) {
                const errorData = await response.json();
                console.error('API error:', errorData);
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Fetch error:', error.message);
            throw error;
        }
    }

    function updateUploadProgress(progress) {
        elements.uploadProgressBar.style.width = `${progress}%`;
        console.log('Upload progress updated:', progress);
    }

    function handleConnectionError(error) {
        console.error('WebSocket connection error:', error.message);
        appendMessage('bot', 'Sorry, there was an error connecting to the server. Please check your internet connection and try again.');
        setTimeout(() => {
            socket.connect();
            console.log('Attempting to reconnect to WebSocket server');
        }, 5000); // Try to reconnect after 5 seconds
    }

    // Global error handler
    window.onerror = function(message, source, lineno, colno, error) {
        console.error('Global error:', { message, source, lineno, colno, error: error.message });
        appendMessage('bot', 'An unexpected error occurred. Our team has been notified.');
        // TODO: Send this error to the server for logging
        // Example: sendErrorToServer({ message, source, lineno, colno, error: error.message });
    };
});
