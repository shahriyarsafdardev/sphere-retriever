import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Configuration, OpenAIApi } from "openai";
import * as minimatch from 'minimatch';
import { getWebviewContent } from './components/chatview';
import * as dotenv from 'dotenv';


dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPEN_API_KEY,
});
const openai = new OpenAIApi(configuration);
let ROOT_PATH = '';
let DIRECTORY_TREE = '';

async function getFilePath(fileName: string) {
  const query = `Your goal is to analyze the directory tree and the root path attached at the end and create the path for this file: ${fileName} that starts with the root path and ends with the filename. Only return the path, nothing else. This the the root path: ${ROOT_PATH} and this is the directory tree: ${DIRECTORY_TREE}`;
  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [{ 'role': 'user', 'content': query }]
  });
  return response?.data?.choices[0]?.message?.content || '';
}

async function chatCompletion(messages: any, model: string = "gpt-3.5-turbo", maxRetries: number = 5): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await openai.createChatCompletion({
        model: model,
        messages: messages?.slice(-3)
      });

      return response?.data?.choices[0]?.message?.content || '';
    } catch (error: any) {
      if (error.name === 'RateLimitError') {
        // exponential back off with jitter
        const waitTime = (2 ** attempt) + Math.random();
        vscode.window.showInformationMessage(`Request exceeded rate limit. Waiting ${waitTime} seconds before retrying.`);
        // JavaScript uses milliseconds for delay functions
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      } else {
        return "Nothing is being found!";
      }
    }
  }

  throw new Error(`Maximum number of retries (${maxRetries}) exceeded.`);
}

async function readGitignore(gitignorePath: string): Promise<string[]> {
  let ignorePatterns: string[] = ['.git'];

  try {
    if (fs.existsSync(gitignorePath)) {
      const lines: string[] = fs.readFileSync(gitignorePath, { encoding: 'utf8' })?.split('\n');
      for (let line of lines) {
        let strippedLine = line?.trim();
        if (strippedLine && !strippedLine?.startsWith("#")) {
          ignorePatterns.push(strippedLine?.endsWith('/') ? strippedLine.slice(0, -1) : strippedLine);
        }
      }
    }

    return ignorePatterns;
  } catch (e) {
    return [];
  }
}

function shouldIgnore(entryPath: string, entry: string, ignorePatterns: string[]): boolean {
  for (let pattern of ignorePatterns) {
    if (minimatch(entryPath, pattern) || minimatch(entry, pattern)) {
      return true;
    }
  }
  return false;
}

function generateDirectoryFileTree(startPath: string, ignorePatterns: string[], indentLevel: number = 0): string {
  try {
    let fileTree: string = "";

    let entries: string[] = fs.readdirSync(startPath).sort();
    for (let entry of entries) {
      let entryPath = path.join(startPath, entry);

      if (shouldIgnore(entryPath, entry, ignorePatterns)) {
        continue;
      }

      if (fs.lstatSync(entryPath).isFile()) {
        fileTree += `${"  ".repeat(indentLevel)}- ${entry}\n`;
      } else if (fs.lstatSync(entryPath).isDirectory()) {
        fileTree += `${"  ".repeat(indentLevel)}* ${entry}\n`;
        fileTree += generateDirectoryFileTree(entryPath, ignorePatterns, indentLevel + 1);
      }
    }

    DIRECTORY_TREE = fileTree;
    return fileTree;
  } catch (e) {
    return "";
  }
}

async function generateRepoFileTree(): Promise<string> {
  try {
    let currentDir: string = ROOT_PATH;
    let gitignorePath: string = path.join(currentDir, ".gitignore");
    let ignorePatterns: string[] = await readGitignore(gitignorePath);

    let fileTree: string = generateDirectoryFileTree(currentDir, ignorePatterns);

    return fileTree;
  } catch (e) {
    return "";
  }
}

function askForFiles(userInput: string, fileTree: string): Object {
  return {
    "role": "user",
    "content": `
        Answer this query: ${userInput}.
        This is my existing code base file tree: ${fileTree}.
        Before providing a response please give me the name of most precised file you want to get view before writing the code,
        so that you have complete context. If any file related to ${userInput} exists then return only that file name and don't add extra text.
        If there is no file related to ${userInput} exists then return 'None'
        `
  };
}

async function handleFirstMessage(userInput: string): Promise<Object[]> {
  let fileTree: string = await generateRepoFileTree();
  let message: Object = askForFiles(userInput, fileTree);
  return [message];
}

function appendUserMessage(userInput: string, messages: Object[]): Object[] {
  let message: Object = {
    "role": "user",
    "content": userInput,
  };
  messages.push(message);
  return messages;
}

function appendAssistantMessage(gptResponse: string, messages: Object[]): Object[] {
  let message: Object = {
    "role": "assistant",
    "content": gptResponse,
  };
  messages.push(message);
  return messages;
}

async function fetchFileContents(fileNames: string[]): Promise<Object> {
  let fileContents: { [key: string]: string } = {};
  for (let fileName of fileNames) {
    try {
      const filePath = await getFilePath(fileName) || '';
      let content: string = fs.readFileSync(filePath, { encoding: 'utf8' });
      fileContents[fileName] = content;
    } catch (e: any) {
      if (e instanceof Error) {
        // File not found, skip this one
        continue;
      } else {
        // Some other error, re-throw it
        throw e;
      }
    }
  }
  return fileContents;
}

export function activate(context: vscode.ExtensionContext) {
  ROOT_PATH = context.extensionPath;
  console.log('File retriever has been activated!');
  // Register webview here
  context.subscriptions.push(
    vscode.commands.registerCommand('sphere-retriever.chat', async () => {
      const apiKey = await getAPIKey();
      if (apiKey) {
        const panel = vscode.window.createWebviewPanel(
          'spherechat',
          'Sphere Retriever - Chat',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );
        let messages: any = [];
        panel.webview.html = getWebviewContent();

        panel.webview.onDidReceiveMessage(
          async message => {
            switch (message.command) {
              case 'submit':
                let query = message.text;
                let [response, updatedMessages] = await getAnswer(query, messages);
                messages = updatedMessages;

                panel.webview.postMessage({ command: 'response', text: response });

                return;
            }
          },
          undefined,
          context.subscriptions
        );
      }
    })
  );
}

const getAPIKey = async () => {
  let apiKey: string | undefined = await vscode.window.showInputBox({
    placeHolder: "Please enter your API key or type 'exit' to quit:",
    prompt: "Please enter your API key or type 'exit' to quit:",
  });

  if (apiKey?.trim()?.toLowerCase() === "exit") {
    return false;
  }

  if (!apiKey || apiKey?.trim() === "" || apiKey?.trim() !== 'sphere-2023') {
    vscode.window.showErrorMessage('Invalid API key. Please try again!');
    return false;
  } else {
    return true;
  }
};

const getAnswer = async (query: string, messages: Object[]) => {
  if (messages.length === 0) {
    messages = await handleFirstMessage(query);
  } else {
    messages = appendUserMessage(query, messages);
  }
  let gptResponse: string = await chatCompletion(messages);

  if (!gptResponse?.toLowerCase()?.includes("none")) {
    messages = appendAssistantMessage(gptResponse, messages);
    let fileNames: string[] = gptResponse.match(/\b[\w-]+\.[\w-]+\b/g) || [];
    fileNames = Array.from(new Set(fileNames));
    let fileContents: Object = await fetchFileContents(fileNames);

    if (Object.keys(fileContents)?.length > 0) {
      messages = appendUserMessage(
        `\nHere are the files you asked for: \n${JSON.stringify(fileContents)}\n`, messages);
      gptResponse = await chatCompletion(messages);
    }

  }
  else {
    if (messages?.length === 1) {
      gptResponse = "Please provide a filename to get started!";
      messages = [];
    }
  }
  return [gptResponse, messages];
};

export function deactivate() {
  vscode.window.showInformationMessage('Files Retriever has been de-activated!');
}
