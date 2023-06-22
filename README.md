# Sphere Retriever

Sphere Retriever is a powerful Visual Studio Code extension which is used to help retrieve and navigate through files in a codebase. Sphere Retriever allows you to chat, ask it to fetch the content of any file from your project, and even generate a complete file tree of your repository.

## Features

1. **Chat About Files:** This extension provides an interactive chat interface, which allows you to chat directly about your files.

2. **Fetch File Contents:** You can ask to fetch the content of any file in your project and it will do so.

3. **Generate Repository File Tree:** The extension can generate and display the file tree of your repository.

4. **Rate Limit Handling:** The extension handles rate limiting from OpenAI's API gracefully, using an exponential backoff strategy with jitter.

## Usage

1. Clone the repository.
2. Open the repository in Visual Studio Code.
3. Run `npm install` to install all the dependencies.
4. Press `F5` or run the `Start Debugging` command from the command palette to start the extension in a new Extension Development Host window.
5. Click on `View` -> `Command Palette`, then search for `Sphere Retriever - Chat` to open the chat interface.

