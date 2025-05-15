// 初始化侧边栏 
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }); 

// 创建右键菜单 
chrome.runtime.onInstalled.addListener(() => { 
  chrome.contextMenus.create({ 
    id: "insertPrompt", 
    title: "插入提示词", 
    contexts: ["editable"] 
  }); 
  chrome.contextMenus.create({
    id: "quickSaveSelectedText",
    title: "快速保存选中的文本为提示词",
    contexts: ["selection"]
  });
}); 

// 处理消息请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 获取提示词列表
  if (request.action === "getPromptsList") {
    chrome.storage.local.get('prompts', (data) => {
      sendResponse({ prompts: data.prompts || [] });
    });
    return true; // 异步响应
  }
  
  // 处理提示词优化请求
  if (request.action === "optimizePrompt") {
    optimizePrompt(request.data, sender.tab?.id)
      .then(() => {
        // 流式处理将在 optimizePrompt 内部发送消息
      })
      .catch(error => {
        // 如果启动流式传输失败，发送错误
        sendResponse({ success: false, error: `启动流式传输失败: ${error.message}` });
      });
    return true; // 异步响应
  }
});

// 提示词优化函数
async function optimizePrompt(data, tabId) {
  const { originalPrompt, template } = data;
  
  // 获取用户设置的变量格式和 OpenRouter 配置
  let variableFormat = {
    start: '{{',
    end: '}}'
  };
  let openrouterApiKey = null;
  let openrouterModel = null;
  let temperature = 0.7; // 默认值
  let topP = 0.7; // 默认值

  try {
    const configData = await new Promise((resolve) => {
      chrome.storage.local.get('config', resolve);
    });
    
    if (configData.config && configData.config.promptOptimization && 
        configData.config.promptOptimization.userSettings) {
      const userSettings = configData.config.promptOptimization.userSettings;
      if (userSettings.variableFormat) {
        variableFormat = userSettings.variableFormat;
      }
      openrouterApiKey = userSettings.openrouterApiKey;
      openrouterModel = userSettings.openrouterModel;
      // 读取 temperature 和 topP 设置
      if (typeof userSettings.temperature === 'number') {
        temperature = userSettings.temperature;
      }
      if (typeof userSettings.topP === 'number') {
        topP = userSettings.topP;
      }
    }
  } catch (error) {
    console.error('获取配置失败，使用默认设置:', error);
  }

  if (!openrouterApiKey || !openrouterModel) {
    const errorMessage = 'OpenRouter API Key 或模型未在设置中配置。';
    console.error(errorMessage);
    // 向特定标签页发送错误信息
    if (tabId) {
        chrome.runtime.sendMessage({ 
            action: "streamError", 
            error: errorMessage, 
            tabId: tabId 
        });
    }
    throw new Error(errorMessage);
  }
  
  const headers = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${openrouterApiKey}`
  };
  
  // 构建请求选项
  const options = {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: openrouterModel,
      messages: [
        { role: "user", content: `${template}\n\n--- 原始提示词内容如下 ---\n${originalPrompt}` }
      ],
      stream: true, // 启用流式传输
      temperature: temperature, // 使用从设置中读取的值
      top_p: topP // 使用从设置中读取的值
    })
  };

  const apiUrl = "https://openrouter.ai/api/v1/chat/completions"; // OpenRouter API URL

  try {
    const response = await fetch(apiUrl, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 请求失败: ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('响应体不存在');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedResult = ''; 

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        chrome.runtime.sendMessage({ action: "streamComplete", finalContent: accumulatedResult, tabId: tabId }); 
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonDataString = line.substring(6).trim();
          if (jsonDataString && jsonDataString !== '[DONE]') {
            try {
              const jsonData = JSON.parse(jsonDataString);
              if (jsonData.choices && jsonData.choices.length > 0) {
                const deltaContent = jsonData.choices[0].delta?.content || '';
                if (deltaContent) {
                  accumulatedResult += deltaContent;
                  chrome.runtime.sendMessage({
                    action: "streamUpdate",
                    chunk: deltaContent,
                    tabId: tabId 
                  });
                }
              }
            } catch (e) {
              console.error('解析 SSE JSON 时出错:', e, 'Line:', line, 'Attempted to parse:', jsonDataString);
               chrome.runtime.sendMessage({ action: "streamError", error: `解析响应数据时出错: ${e.message} (原始行: ${line})`, tabId: tabId });
            }
          }
        } else if (line.trim() && line !== 'data: [DONE]') { 
           console.log("Received non-data line:", line);
        }
      }
    }
  } catch (error) {
    console.error('调用 API 时出错:', error);
     chrome.runtime.sendMessage({ action: "streamError", error: `API 调用失败: ${error.message}`, tabId: tabId });
     throw error; 
  }
}

// 新函数：使用 OpenRouter API 生成标题和标签
async function generateTitleAndTagsForPrompt(text) {
  try {
    const configData = await new Promise((resolve) => {
      chrome.storage.local.get('config', resolve);
    });

    const userSettings = configData.config?.promptOptimization?.userSettings;
    const apiKey = userSettings?.openrouterApiKey;
    const model = userSettings?.openrouterModel;

    if (!apiKey || !model) {
      console.warn('OpenRouter API Key 或模型未配置，无法生成标题和标签。');
      return null; // 或返回一个表示配置缺失的特定对象
    }

    const promptContent = `根据以下文本，生成一个简短的标题（10个字以内）和5个相关的标签（每个标签2-4个字，逗号分隔）。请直接返回JSON格式，包含 title 和 tags 两个字段，不要包含任何其他解释或引导词，不要使用代码块。文本内容：\n\n${text}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": model,
        "messages": [
          {
            "role": "user",
            "content": promptContent
          }
        ],
        "response_format": { "type": "json_object" } // 请求JSON格式的响应
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter API 请求失败: ${response.status} - ${errorText}`);
      throw new Error(`API 请求失败: ${response.status}`);
    }

    const result = await response.json();
    if (result.choices && result.choices.length > 0 && result.choices[0].message?.content) {
      try {
        // 尝试解析API返回的JSON字符串
        const contentJson = JSON.parse(result.choices[0].message.content);
        return {
          title: contentJson.title || text.substring(0, 30) + (text.length > 30 ? "..." : ""),
          tags: contentJson.tags ? contentJson.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []
        };
      } catch (e) {
        console.error("解析OpenRouter返回的JSON时出错:", e, "原始响应:", result.choices[0].message.content);
        // 解析失败时，使用默认标题和空标签
        return {
          title: text.substring(0, 30) + (text.length > 30 ? "..." : ""),
          tags: []
        };
      }
    } else {
      console.warn('OpenRouter API 未返回有效内容。');
      return null;
    }
  } catch (error) {
    console.error('调用 OpenRouter API 生成标题和标签时出错:', error);
    return null; // 出错时返回 null，让调用者处理回退逻辑
  }
}

// 新函数：使用 OpenRouter API 将文本中的占位符转换为用户定义的变量格式
async function transformPlaceholdersToVariables(originalText, targetVariableFormat) {
  try {
    const configData = await new Promise((resolve) => {
      chrome.storage.local.get('config', resolve);
    });

    const userSettings = configData.config?.promptOptimization?.userSettings;
    const apiKey = userSettings?.openrouterApiKey;
    // 尝试使用用户指定的模型，如果未指定，则使用一个默认的通用模型，例如 Claude Haiku 或类似能力的免费/低成本模型
    const model = userSettings?.openrouterModel || 'anthropic/claude-3-haiku'; // 默认模型

    if (!apiKey) {
      console.warn('OpenRouter API Key 未配置，无法转换占位符。');
      return { success: false, error: 'OpenRouter API Key 未配置', processedText: originalText };
    }

    const systemPrompt = `你是一个智能文本处理助手。你的任务是识别用户输入文本中的占位符（例如 "{占位符}" 或 "[占位符]"），并将它们转换为用户指定的变量格式。同时，你需要为这些占位符生成更具描述性的中文变量名。

用户指定的变量格式是：开始标记为 "${targetVariableFormat.start}"，结束标记为 "${targetVariableFormat.end}"。

例如，如果用户指定的格式是 "{{变量名}}"：
- 输入文本中的 "{文件名}" 应该被转换为类似 "{{文件名称}}" 或 "{{具体文件名}}" 的形式。
- 输入文本中的 "[背景颜色]" 应该被转换为类似 "{{背景颜色描述}}" 或 "{{主要背景色}}" 的形式。

请专注于识别和转换，并生成简洁、清晰的中文变量名。
直接返回一个 JSON 对象，包含一个 "processedText" 字段，其值为处理后的文本。不要包含任何其他解释、引导词或代码块。`;

    const userPrompt = `请处理以下文本，将其中的占位符（如 "{}" 或 "[]"）转换为 "${targetVariableFormat.start}描述性中文变量名${targetVariableFormat.end}" 的格式。请为变量名生成合适的中文描述。

文本内容：
${originalText}

请确保返回的 JSON 对象中，"processedText" 字段的值是处理后的完整文本。`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": model,
        "messages": [
          { "role": "system", "content": systemPrompt },
          { "role": "user", "content": userPrompt }
        ],
        "response_format": { "type": "json_object" },
        "temperature": 0.5, // 较低的温度以获得更可预测和一致的命名
        "max_tokens": 2000 // 根据输入文本长度和预期输出调整
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter API 请求失败 (转换占位符): ${response.status} - ${errorText}`);
      return { success: false, error: `API 请求失败: ${response.status}`, processedText: originalText };
    }

    const result = await response.json();
    if (result.choices && result.choices.length > 0 && result.choices[0].message?.content) {
      try {
        const contentJson = JSON.parse(result.choices[0].message.content);
        if (contentJson && typeof contentJson.processedText === 'string') {
          return { success: true, processedText: contentJson.processedText };
        } else {
          console.error("OpenRouter 返回的JSON格式不正确或缺少 processedText 字段:", result.choices[0].message.content);
          return { success: false, error: 'AI 返回数据格式错误', processedText: originalText };
        }
      } catch (e) {
        console.error("解析OpenRouter返回的JSON时出错 (转换占位符):", e, "原始响应:", result.choices[0].message.content);
        return { success: false, error: '解析 AI 响应失败', processedText: originalText };
      }
    } else {
      console.warn('OpenRouter API 未返回有效内容 (转换占位符)。');
      return { success: false, error: 'AI 未返回有效内容', processedText: originalText };
    }
  } catch (error) {
    console.error('调用 OpenRouter API 转换占位符时出错:', error);
    return { success: false, error: `处理时发生错误: ${error.message}`, processedText: originalText };
  }
}

// 处理右键菜单点击事件 
chrome.contextMenus.onClicked.addListener(async (info, tab) => { // 将回调设为 async
  if (info.menuItemId === "insertPrompt") { 
    // 检查标签页是否可以注入脚本 
    if (tab.url && tab.url.startsWith("http")) {
      // 使用activeTab权限执行脚本，确保能够与页面交互
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          // 这个函数会在目标页面的上下文中执行
          console.log("右键菜单已激活，准备显示提示词选择器");
          // 这里不需要做什么，只是确保activeTab权限被正确激活
        }
      }).then(() => {
        // 脚本执行成功后，发送消息给content脚本
        chrome.tabs.sendMessage(tab.id, { action: "openPromptSelector" });
      }).catch(error => {
        console.error("执行脚本时出错:", error);
        alert("无法在当前页面使用此功能");
      });
    } else { 
      alert("无法在当前页面使用此功能"); 
    } 
  } else if (info.menuItemId === "quickSaveSelectedText") {
    if (info.selectionText && tab) {
      const selectedText = info.selectionText.trim();
      if (selectedText) {
        let processedTextForSaving = selectedText;
        let title = selectedText.length > 30 ? selectedText.substring(0, 30) + "..." : selectedText;
        let tags = [];

        // 新增：首先尝试转换占位符
        try {
          const configData = await new Promise((resolve) => {
            chrome.storage.local.get('config', resolve);
          });
          const userSettings = configData.config?.promptOptimization?.userSettings;
          const targetVariableFormat = userSettings?.variableFormat;

          if (targetVariableFormat && targetVariableFormat.start && targetVariableFormat.end) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: 'AI 变量转换',
              message: '正在尝试将文本中的占位符转换为变量格式...',
              priority: 0
            });
            const transformResult = await transformPlaceholdersToVariables(selectedText, targetVariableFormat);
            if (transformResult.success) {
              processedTextForSaving = transformResult.processedText;
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'AI 变量转换成功',
                message: '已成功转换占位符为变量格式。',
                priority: 0
              });
            } else {
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'AI 变量转换失败',
                message: `未能转换占位符: ${transformResult.error || '未知错误'}。将使用原始文本。`,
                priority: 0
              });
            }
          } else {
            // console.log("用户未配置变量格式，跳过AI占位符转换。");
          }
        } catch (error) {
          console.error("调用AI转换占位符失败:", error);
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'AI 变量转换出错',
            message: '尝试转换占位符时发生错误，将使用原始文本。',
            priority: 0
          });
        }
        // ----- AI转换占位符结束 -----

        // 调用API生成标题和标签 (基于可能已处理过的 processedTextForSaving)
        try {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: '正在生成摘要...',
            message: '正在使用 AI 为提示词生成标题和标签，请稍候。',
            priority: 0
          });

          const generatedData = await generateTitleAndTagsForPrompt(processedTextForSaving);
          if (generatedData && generatedData.title) {
            title = generatedData.title;
          }
          if (generatedData && generatedData.tags) {
            tags = generatedData.tags;
          }
        } catch (error) {
          console.error("调用AI生成标题和标签失败:", error);
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'AI生成失败',
            message: '自动生成标题和标签失败，将使用默认方式保存。',
            priority: 0
          });
        }

        // 创建新的提示词对象
        const newPrompt = {
          id: Date.now().toString(),
          title: title,
          content: processedTextForSaving,
          tags: tags, // 使用生成的或默认的标签
          link: tab.url, // 自动获取当前页面链接
          createdAt: new Date().toISOString()
        };

        // 保存到存储
        chrome.storage.local.get('prompts', (data) => {
          const prompts = data.prompts || [];
          prompts.unshift(newPrompt); // 添加到列表开头
          chrome.storage.local.set({ prompts }, () => {
            // 显示成功通知
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: '提示词已保存',
              message: `提示词 "${newPrompt.title}" 已快速保存。标签：${newPrompt.tags.join('#') || '无'}`,
              priority: 0
            });
          });
        });
      }
    }
  } 
}); 

// 监听来自侧边栏的消息 
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // console.log("Background received message:", message, "from sender:", sender);

  // 获取提示词列表 (通用，可被 content.js 或 sidepanel.js 调用)
  if (message.action === "getPromptsList") {
    chrome.storage.local.get('prompts', (data) => {
      sendResponse({ prompts: data.prompts || [] });
    });
    return true; // 异步响应
  }

  // 处理来自 optimize.js 的提示词优化请求
  if (message.action === "optimizePrompt") {
    optimizePrompt(message.data, sender.tab?.id) // 确保传递 tabId
      .then(() => {
        // 流式处理将在 optimizePrompt 内部发送消息
      })
      .catch(error => {
        // 如果启动流式传输失败，发送错误
        // 注意：optimizePrompt 内部已经有错误处理发送到 streamError，这里可能冗余
        // 但保留以防 optimizePrompt 本身抛出未捕获的错误导致 promise reject
        chrome.runtime.sendMessage({ 
            action: "streamError", 
            error: `启动流式传输失败: ${error.message}`, 
            tabId: sender.tab?.id // 确保传递 tabId
        });
        // sendResponse({ success: false, error: `启动流式传输失败: ${error.message}` }); // 这个 sendResponse 可能不会到达 optimize.js
      });
    return true; // 异步响应
  }

  // 来自侧边栏：打开侧边栏（通常由其他扩展部分触发，但为完整性保留）
  if (message.action === "openSidePanel") {
    try {
      if (sender && sender.tab && sender.tab.id) {
        chrome.sidePanel.open({ tabId: sender.tab.id });
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs.length > 0 && tabs[0].id) {
            chrome.sidePanel.open({ tabId: tabs[0].id });
          } else {
            chrome.sidePanel.open();
            console.warn("无法确定tabId来打开侧边栏，将尝试全局打开。");
          }
        });
      }
      sendResponse({ success: true });
    } catch (error) {
      console.error("打开侧边栏时出错:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // 异步响应
  }

  // 来自侧边栏：插入提示词到页面
  if (message.action === "insertPrompt") {
    let hasResponded = false;
    const timeoutId = setTimeout(() => {
      if (!hasResponded) {
        hasResponded = true;
        sendResponse({ 
          success: false, 
          error: "操作超时，尝试直接复制到剪贴板", 
          clipboardFallback: true // 提示侧边栏可以尝试复制
        });
        // 注意：后台脚本通常不能直接操作剪贴板，除非有特殊权限或使用 offscreen document
        // copyToClipboard(message.prompt.content, null); // 这行可能无法按预期工作
      }
    }, 3000);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        const tabId = tabs[0].id;
        if (!tabs[0].url || !tabs[0].url.startsWith("http")) {
          clearTimeout(timeoutId);
          if (!hasResponded) {
            hasResponded = true;
            sendResponse({ success: false, error: "无法在当前页面使用此功能" });
          }
          return;
        }
        
        // 尝试发送消息到 content.js
        chrome.tabs.sendMessage(tabId, { 
          action: "insertPromptContent", // 这是 content.js 中监听的 action
          prompt: message.prompt 
        }, (responseFromContent) => {
          clearTimeout(timeoutId);
          if (!hasResponded) {
            hasResponded = true;
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: `与内容脚本通信失败: ${chrome.runtime.lastError.message}`, clipboardFallback: true });
            } else if (responseFromContent && responseFromContent.success) {
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, error: responseFromContent?.error || "内容脚本未能成功插入提示词", clipboardFallback: responseFromContent?.clipboardFallback });
            }
          }
        });
      } else {
        clearTimeout(timeoutId);
        if (!hasResponded) {
          hasResponded = true;
          sendResponse({ success: false, error: "没有找到活跃的标签页" });
        }
      }
    });
    return true; // 异步响应
  }

  // 来自 content.js 或 sidepanel.js：增加提示词使用次数
  if (message.action === "incrementPromptUsage" && message.promptId) {
    chrome.storage.local.get('prompts', (data) => {
      let prompts = data.prompts || [];
      const promptIndex = prompts.findIndex(p => p.id === message.promptId);
      if (promptIndex !== -1) {
        prompts[promptIndex].usageCount = (prompts[promptIndex].usageCount || 0) + 1;
        prompts[promptIndex].lastUsedAt = new Date().toISOString();
        chrome.storage.local.set({ prompts: prompts }, () => {
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: false, error: "Prompt not found" });
      }
    });
    return true; // 异步响应
  }
  
  // 新增：来自 sidepanel.js：转换占位符
  if (message.action === "transformPlaceholders") {
    const { originalText, targetVariableFormat } = message.data;
    transformPlaceholdersToVariables(originalText, targetVariableFormat)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        // 捕获 transformPlaceholdersToVariables 内部未处理的异常
        sendResponse({ success: false, error: `转换占位符时发生意外错误: ${error.message}`, processedText: originalText });
      });
    return true; // 异步响应
  }

  // 新增：来自 sidepanel.js：批量更新提示词中的变量格式
  if (message.action === "batchUpdateVariableFormats") {
    const { oldFormat, newFormat } = message.data;
    if (!oldFormat || !newFormat || !oldFormat.start || !oldFormat.end || !newFormat.start || !newFormat.end) {
      sendResponse({ success: false, error: "旧格式或新格式无效。" });
      return false;
    }

    chrome.storage.local.get('prompts', (data) => {
      let prompts = data.prompts || [];
      let updatedCount = 0;

      // 辅助函数：转义正则表达式特殊字符
      function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\\\]]/g, '\\$&'); // $&表示整个被匹配的字符串
      }

      const oldStartEscaped = escapeRegExp(oldFormat.start);
      const oldEndEscaped = escapeRegExp(oldFormat.end);
      // 正则表达式：匹配旧的开始标记，捕获中间的内容（非贪婪），然后匹配旧的结束标记
      const variableRegex = new RegExp(`${oldStartEscaped}(.+?)${oldEndEscaped}`, 'g');

      prompts = prompts.map(prompt => {
        let originalContent = prompt.content;
        if (typeof originalContent === 'string' && originalContent.includes(oldFormat.start) && originalContent.includes(oldFormat.end)) {
          const newContent = originalContent.replace(variableRegex, (match, variableName) => {
            // variableName 是捕获组1，即旧标记之间的内容
            return `${newFormat.start}${variableName}${newFormat.end}`;
          });
          if (newContent !== originalContent) {
            prompt.content = newContent;
            updatedCount++;
          }
        }
        return prompt;
      });

      if (updatedCount > 0) {
        chrome.storage.local.set({ prompts }, () => {
          sendResponse({ success: true, updatedCount: updatedCount });
        });
      } else {
        sendResponse({ success: true, updatedCount: 0, message: "没有找到需要更新的变量格式。" });
      }
    });
    return true; // 异步响应
  }

  // 对于 optimize.js 发送的 streamUpdate/streamComplete/streamError 不需要响应
  if (message.action === "streamUpdate" || message.action === "streamComplete" || message.action === "streamError") {
    // 这些消息是单向的，用于更新UI，不需要 sendResponse
    return false; 
  }

  // 如果没有匹配的 action，可以考虑返回 false 或不返回
  // console.log("Background received unhandled message action:", message.action);
  // sendResponse({success: false, error: "Unknown action"}); // 可选：对未知 action 回复
  return false; // 对于未显式处理并返回 true 的消息，默认为同步
});

// 辅助函数：发送提示词消息 (这个函数看起来像是旧的，并且它的逻辑已经被合并到上面的 onMessage 监听器中了，可以考虑移除或重构)
/*
function sendPromptMessage(tabId, prompt, callback) { 
  chrome.tabs.sendMessage(tabId, { 
    action: "insertPromptContent", 
    prompt: prompt 
  }, (response) => { 
    if (chrome.runtime.lastError) { 
      console.error("发送消息时出错:", chrome.runtime.lastError.message); 
      if (callback) callback(false, chrome.runtime.lastError.message);
    } else { 
      if (callback) callback(response.success, response.error); // 修改以传递成功状态和错误信息
    } 
  }); 
} 
*/

// 辅助函数：复制到剪贴板 (这个函数在 background script 中通常无法直接工作，除非使用 offscreen API 或有特殊权限)
// 建议将复制操作保留在 content script 或 side panel 中。
// 如果确实需要从 background 复制，需要查阅 Manifest V3 的 Offscreen Documents API。
/*
function copyToClipboard(text, callback) { 
  // ... (实现可能需要 Offscreen API) ...
  console.warn("copyToClipboard in background.js might not work as expected without Offscreen API.");
  if (callback) callback(false); // 示例：假设失败
}
*/

// 监听扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
  try {
    if (tab && tab.id) {
      chrome.sidePanel.open({ tabId: tab.id });
    } else {
      // 如果没有 tab 信息（例如，从扩展管理页面点击），尝试全局打开
      chrome.sidePanel.open();
    }
  } catch (error) {
    console.error("打开侧边栏时出错:", error);
  }
});

// 移除之前重复的 chrome.runtime.onMessage.addListener
// ... (确保只有一个 onMessage listener)
// 检查并移除第568行附近的重复监听器
// 原始文件到 635 行结束。
// 此处不再有重复的监听器。