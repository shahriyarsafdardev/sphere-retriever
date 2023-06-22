export function getWebviewContent() {
    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Chat</title>
                <style>
                    body {
                        background-color: #1a1a1a;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        height: 100vh;
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                        font-family: Arial, sans-serif;
                    }
                    .chat-container {
                        display: flex;
                        flex-direction: column;
                        width: 80%;
                        height: 80vh;
                        padding: 10px;
                        overflow: auto;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        margin: auto;
                        background-color: #2b2b2b;
                    }
                    .chat-entry {
                        margin: 10px 0;
                        padding: 10px 20px;
                        border-radius: 10px;
                        font-size: 16px;
                        max-width: 55%;
                        word-break: break-word;
                    }
                    .user {
                        align-self: flex-end;
                        background-color: #0b93f6;
                        color: #fff;
                    }
                    .assistant {
                        align-self: flex-start;
                        background-color: #444;
                        color: #fff;
                    }
                    #queryForm {
                        display: flex;
                        padding: 10px;
                        background-color: #2b2b2b;
                        width: 90%;
                        margin: auto;
                        border-radius: 10px;
                    }
                    #queryInput {
                        flex-grow: 1;
                        border-radius: 5px;
                        padding: 5px;
                        border: 1px solid #ddd;
                    }
                    input[type="submit"] {
                        margin-left: 10px;
                        border-radius: 5px;
                        padding: 5px 10px;
                        border: none;
                        color: #fff;
                        background-color: #0b93f6;
                    }
                    /* Loader styling */
                    .loader {
                        border: 3px dotted white;
                        border-radius: 50%;
                        border-top: 3px solid transparent;
                        width: 24px;
                        height: 24px;
                        animation: spin 1s linear infinite;
                        margin: auto;
                        display: none;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </head>
            <body>
                <div class="chat-container" id="chatContainer"></div>
                <form id="queryForm">
                    <input type="text" id="queryInput" name="queryInput" placeholder="Ask anything about your code...">
                    <div class="loader" id="loader"></div>
                </form>
                <script>
                    const vscode = acquireVsCodeApi();
                    const form = document.getElementById('queryForm');
                    const input = document.getElementById('queryInput');
                    const chatContainer = document.getElementById('chatContainer');
                    const loader = document.getElementById('loader');

                    input.focus();

                    form.addEventListener('submit', (event) => {
                        event.preventDefault();
                        const query = input.value;
                        input.value = '';

                        const userDiv = document.createElement('div');
                        userDiv.className = 'chat-entry user';
                        userDiv.innerText = query;
                        chatContainer.appendChild(userDiv);

                        loader.style.display = 'inline-block'; // show loader
                        input.style.display = 'none'; // hide form

                        vscode.postMessage({ command: 'submit', text: query });
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'response':
                                const response = message.text;
                                const assistantDiv = document.createElement('div');
                                assistantDiv.className = 'chat-entry assistant';
                                assistantDiv.innerText = response;
                                chatContainer.appendChild(assistantDiv);
                                chatContainer.scrollTop = chatContainer.scrollHeight;

                                loader.style.display = 'none'; // hide loader
                                input.style.display = 'flex'; // show form
                                input.focus()
                        }
                    });
                </script>
            </body>
            </html>`;
}
