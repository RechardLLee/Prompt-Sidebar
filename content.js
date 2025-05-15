// 全局配置
let userSettings = {
  variableFormat: {
    start: '{{',
    end: '}}'
  },
  triggerCommand: '\\p'
};

// 跟踪上一次输入值和提示词选择器状态
let lastInputValue = '';
let isPromptSelectorOpen = false;
let promptPopup = null;

// 初始化时加载用户设置
chrome.storage.local.get('config', (data) => {
  if (data.config && data.config.promptOptimization && data.config.promptOptimization.userSettings) {
    userSettings = data.config.promptOptimization.userSettings;
  }
});

// 监听输入框输入事件
document.addEventListener('input', async (event) => {
  // 检查事件目标是否为标准输入元素（输入框或文本域）
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target.isContentEditable) {
    const inputElement = event.target;
    const value = inputElement instanceof HTMLElement && inputElement.isContentEditable 
      ? inputElement.textContent 
      : inputElement.value;

    // 检查是否输入了触发命令并且弹窗尚未打开
    if (value && value.endsWith(userSettings.triggerCommand) && !isPromptSelectorOpen) {
      // 重置lastInputValue，解决连续输入触发命令无法触发的问题
      lastInputValue = value;
      isPromptSelectorOpen = true;
      
      // 保存当前活跃的输入元素和位置信息
      window.activeElement = inputElement;
      window.activeElementRect = inputElement.getBoundingClientRect();
      
      // 移除触发命令，同样使用最新的 userSettings.triggerCommand
      const currentTriggerCommand = userSettings.triggerCommand;
      if (inputElement instanceof HTMLElement && inputElement.isContentEditable) {
        // 对于contentEditable元素，需要特殊处理
        inputElement.textContent = value.substring(0, value.length - currentTriggerCommand.length);
      } else {
        // 对于普通输入框，使用value属性
        const start = inputElement.selectionStart || 0;
        const newStart = Math.max(0, start - currentTriggerCommand.length);
        const beforeText = inputElement.value.substring(0, newStart);
        const afterText = inputElement.value.substring(start);
        inputElement.value = beforeText + afterText;
        
        // 设置光标位置
        inputElement.selectionStart = inputElement.selectionEnd = newStart;
        
        // 触发input事件以通知页面内容已更改
        const inputEvent = new Event('input', { bubbles: true });
        inputElement.dispatchEvent(inputEvent);
      }
      
      // 获取提示词列表并显示在输入框附近
      chrome.runtime.sendMessage({ action: "getPromptsList" }, (response) => {
        if (response && response.prompts) {
          showPromptSelector(inputElement, response.prompts);
        }
      });
    }
  }
});

// 显示提示词选择器
function showPromptSelector(inputElement, prompts) {
  // 如果已经有弹窗，先移除
  if (promptPopup) {
    document.body.removeChild(promptPopup);
  }
  
  // 创建提示词选择器弹窗
  promptPopup = document.createElement('div');
  promptPopup.className = 'prompt-selector-popup';
  
  // 添加搜索框
  const searchContainer = document.createElement('div');
  searchContainer.className = 'prompt-search-container';
  
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = '搜索提示词...';
  searchInput.className = 'prompt-search-input';
  
  searchContainer.appendChild(searchInput);
  promptPopup.appendChild(searchContainer);
  
  // 创建提示词列表容器
  const promptsList = document.createElement('div');
  promptsList.className = 'prompt-selector-list';
  
  // 添加提示词项目
  prompts.forEach(prompt => {
    const promptItem = document.createElement('div');
    promptItem.className = 'prompt-selector-item';
    
    const promptTitle = document.createElement('div');
    promptTitle.className = 'prompt-selector-title';
    promptTitle.textContent = prompt.title;
    
    // 新增：如果提示词有图片，则添加图片预览容器
    if (prompt.imagePreviewUrl) {
      const imagePreviewContainer = document.createElement('div');
      imagePreviewContainer.className = 'prompt-selector-image-preview-container';
      const imagePreview = document.createElement('img');
      imagePreview.src = prompt.imagePreviewUrl;
      imagePreview.alt = prompt.title + ' 预览';
      imagePreview.className = 'prompt-selector-image-preview';
      imagePreviewContainer.appendChild(imagePreview);
      promptItem.appendChild(imagePreviewContainer); // 图片预览放在标题下方
    }
    
    const promptPreview = document.createElement('div');
    promptPreview.className = 'prompt-selector-preview';
    const previewText = prompt.content.length > 100 
      ? prompt.content.substring(0, 100) + '...' 
      : prompt.content;
    
    // 使用highlightVariables函数来高亮变量
    promptPreview.innerHTML = highlightVariables(previewText);
    
    promptItem.appendChild(promptTitle);
    // 将图片预览容器的插入位置调整到标题和内容预览之间 (如果已创建)
    const existingImagePreview = promptItem.querySelector('.prompt-selector-image-preview-container');
    if (existingImagePreview) {
        promptTitle.after(existingImagePreview);
    }
    promptItem.appendChild(promptPreview);
    
    // 添加点击事件
    promptItem.addEventListener('click', () => {
      usePrompt(prompt);
      document.body.removeChild(promptPopup);
      promptPopup = null;
      // 重置标志，允许再次触发
      isPromptSelectorOpen = false;
      lastInputValue = '';
    });
    
    promptsList.appendChild(promptItem);
  });
  
  promptPopup.appendChild(promptsList);
  
  // 计算弹窗位置
  const rect = inputElement.getBoundingClientRect();
  promptPopup.style.position = 'absolute';
  promptPopup.style.zIndex = '10000';
  
  // 根据输入框位置决定弹窗显示在上方还是下方
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - rect.bottom;
  const popupHeight = Math.min(prompts.length * 60 + 50, 350); // 估算高度
  
  if (spaceBelow >= popupHeight || spaceBelow >= rect.top) {
    // 显示在输入框下方
    promptPopup.style.top = `${rect.bottom + window.scrollY}px`;
  } else {
    // 显示在输入框上方
    promptPopup.style.top = `${rect.top + window.scrollY - popupHeight}px`;
  }
  
  promptPopup.style.left = `${rect.left + window.scrollX}px`;
  promptPopup.style.width = `${Math.max(rect.width, 300)}px`;
  
  // 添加搜索功能
  searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase();
    const items = promptsList.querySelectorAll('.prompt-selector-item');
    
    items.forEach((item, index) => {
      const title = item.querySelector('.prompt-selector-title').textContent.toLowerCase();
      const content = item.querySelector('.prompt-selector-preview').textContent.toLowerCase();
      
      if (title.includes(searchTerm) || content.includes(searchTerm)) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  });
  
  // 添加点击外部关闭弹窗
  document.addEventListener('click', function closePopup(e) {
    if (promptPopup && !promptPopup.contains(e.target) && e.target !== inputElement) {
      document.body.removeChild(promptPopup);
      promptPopup = null;
      // 重置标志，允许再次触发
      isPromptSelectorOpen = false;
      lastInputValue = '';
      document.removeEventListener('click', closePopup);
    }
  });
  
  // 添加 ESC 键关闭弹窗
  document.addEventListener('keydown', function escClose(e) {
    if (e.key === 'Escape' && promptPopup) {
      document.body.removeChild(promptPopup);
      promptPopup = null;
      // 重置标志，允许再次触发
      isPromptSelectorOpen = false;
      lastInputValue = '';
      document.removeEventListener('keydown', escClose);
    }
  });
  
  // 将弹窗添加到页面
  document.body.appendChild(promptPopup);
  
  // 聚焦搜索框
  searchInput.focus();
}

// 使用提示词
async function usePrompt(prompt) {
  try {
    // 处理提示词中的变量
    const processedResult = await processVariables(prompt.content);
    
    // 检查是否取消了操作
    if (processedResult && processedResult.cancelled) {
      console.log("用户取消了变量输入");
      return; // 如果取消了，直接返回，不执行后续插入操作
    }
    
    // 获取处理后的内容
    const processedContent = processedResult.cancelled ? null : processedResult;
    
    // 如果没有内容（被取消），则不执行后续操作
    if (!processedContent) return;
    
    // 尝试获取活跃元素
    let currentActiveElement = document.activeElement;
    
    // 如果没有活跃元素或活跃元素不是输入框，尝试使用保存的活跃元素
    if (!currentActiveElement || 
        (currentActiveElement.tagName !== 'INPUT' && 
         currentActiveElement.tagName !== 'TEXTAREA' && 
         !currentActiveElement.isContentEditable)) {
      currentActiveElement = window.activeElement;
    }
    
    // 尝试插入文本
    let success = false;
    
    if (currentActiveElement && 
        (currentActiveElement.tagName === 'INPUT' || 
         currentActiveElement.tagName === 'TEXTAREA' || 
         currentActiveElement.isContentEditable)) {
      
      // 根据元素类型插入文本
      if (currentActiveElement.isContentEditable) {
        // 对于contentEditable元素
        currentActiveElement.textContent += processedContent;
        success = true;
      } else {
        // 对于input和textarea元素
        const start = currentActiveElement.selectionStart || 0;
        const end = currentActiveElement.selectionEnd || 0;
        const beforeText = currentActiveElement.value.substring(0, start);
        const afterText = currentActiveElement.value.substring(end);
        
        currentActiveElement.value = beforeText + processedContent + afterText;
        
        // 设置光标位置
        currentActiveElement.selectionStart = currentActiveElement.selectionEnd = start + processedContent.length;
        
        // 触发input事件以通知页面内容已更改
        const event = new Event('input', { bubbles: true });
        currentActiveElement.dispatchEvent(event);
        
        success = true;
      }
      
      // 确保焦点返回到原始输入框
      currentActiveElement.focus();
    }
    
    if (success) {
      showNotification("提示词已插入");
      // 新增：通知 background.js 增加使用次数
      chrome.runtime.sendMessage({ action: "incrementPromptUsage", promptId: prompt.id });
    } else {
      console.log("没有活跃的输入元素，尝试复制到剪贴板");
      copyToClipboard(processedContent);
    }
  } catch (error) {
    console.error('使用提示词时出错:', error);
    showNotification("处理提示词时出错", "error");
  }
}

// 处理变量替换 - 优化版本
function processVariables(promptText) {
  // 动态构建变量匹配正则表达式
  const startEscaped = userSettings.variableFormat.start.replace(/[.*+?^${}()|[\\\]]/g, '\\$&');
  const endEscaped = userSettings.variableFormat.end.replace(/[.*+?^${}()|[\\\]]/g, '\\$&');
  const variableRegex = new RegExp(startEscaped + '(.+?)' + endEscaped, 'g');
  
  const matches = [...promptText.matchAll(variableRegex)]; // 使用 matchAll 获取所有匹配项及其捕获组

  // 如果没有变量，直接返回原文本
  if (matches.length === 0) {
    return Promise.resolve(promptText);
  }
  
  const fullMatchStrings = matches.map(match => match[0]); // 完整的匹配字符串，例如 "{{currentTime}}"
  const capturedVariableNames = matches.map(match => match[1]); // 捕获的变量名，例如 "currentTime" 或 " currentTime "

  // 创建一个Promise来处理异步的变量输入
  return new Promise(async (resolve) => { // 使回调变为 async
    // 创建模态对话框
    const modal = document.createElement('div');
    modal.className = 'prompt-variables-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '10000';
    
    // 创建对话框内容
    const modalContent = document.createElement('div');
    modalContent.className = 'prompt-variables-content';
    modalContent.style.backgroundColor = 'rgba(30, 30, 35, 0.85)';
    modalContent.style.borderRadius = '12px';
    modalContent.style.padding = '24px';
    modalContent.style.width = '400px';
    modalContent.style.maxWidth = '90%';
    modalContent.style.maxHeight = '80vh';
    modalContent.style.overflowY = 'auto';
    modalContent.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
    modalContent.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    
    // 添加标题
    const title = document.createElement('div');
    title.className = 'prompt-variables-title';
    title.style.marginTop = '0';
    title.style.marginBottom = '20px';
    title.style.textAlign = 'center';
    
    const titleText = document.createElement('h3');
    titleText.textContent = '请输入变量值';
    titleText.style.margin = '0 0 8px 0';
    titleText.style.color = '#ffffff';
    titleText.style.fontSize = '18px';
    titleText.style.fontWeight = '600';
    titleText.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.3)';
    
    const subtitle = document.createElement('div');
    subtitle.textContent = 'Tab 键切换输入框 · Enter 键确认';
    subtitle.style.color = 'rgba(255, 255, 255, 0.7)';
    subtitle.style.fontSize = '13px';
    subtitle.style.fontWeight = '400';
    
    title.appendChild(titleText);
    title.appendChild(subtitle);
    modalContent.appendChild(title);
    
    // 创建表单
    const form = document.createElement('form');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '12px';
    
    // 为每个变量创建输入框
    const inputs = {};

    // 定义预填充值
    const predefinedValues = {
      currentDate: new Date().toISOString().split('T')[0],
      currentTime: new Date().toLocaleTimeString(),
      currentURL: window.location.href,
      pageTitle: document.title,
      selectedText: typeof window.getSelection === 'function' ? window.getSelection().toString() : ''
    };

    capturedVariableNames.forEach(capturedName => { // 使用正确捕获的变量名
      const cleanVarName = capturedName.trim(); // 用于查找和显示，例如 "currentTime"

      const formGroup = document.createElement('div');
      formGroup.style.marginBottom = '12px';
      
      const label = document.createElement('label');
      label.textContent = cleanVarName; // 显示清理后的变量名
      label.style.display = 'block';
      label.style.marginBottom = '6px';
      label.style.fontWeight = '500';
      label.style.color = '#ffffff';
      
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = `请输入${cleanVarName}的值...`;
      input.style.width = '100%';
      input.style.padding = '10px 12px';
      input.style.borderRadius = '6px';
      input.style.border = '1px solid rgba(255, 255, 255, 0.2)';
      input.style.backgroundColor = 'rgba(50, 50, 55, 0.8)';
      input.style.color = '#ffffff';
      input.style.fontSize = '14px';
      
      // 预填充逻辑
      if (predefinedValues.hasOwnProperty(cleanVarName)) {
        input.value = predefinedValues[cleanVarName];
      }

      formGroup.appendChild(label);
      formGroup.appendChild(input);
      form.appendChild(formGroup);
      
      inputs[cleanVarName] = input; // 使用清理后的变量名作为键
    });
    
    // 添加按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'space-between';
    buttonContainer.style.marginTop = '16px';
    
    // 取消按钮
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消';
    cancelButton.style.padding = '10px 16px';
    cancelButton.style.borderRadius = '6px';
    cancelButton.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    cancelButton.style.backgroundColor = 'rgba(60, 60, 65, 0.8)';
    cancelButton.style.color = '#ffffff';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.fontSize = '14px';
    
    // 确认按钮
    const confirmButton = document.createElement('button');
    confirmButton.textContent = '确认';
    confirmButton.style.padding = '10px 16px';
    confirmButton.style.borderRadius = '6px';
    confirmButton.style.border = 'none';
    confirmButton.style.backgroundColor = '#4285f4';
    confirmButton.style.color = 'white';
    confirmButton.style.cursor = 'pointer';
    confirmButton.style.fontSize = '14px';
    confirmButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
    
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);
    
    form.appendChild(buttonContainer);
    modalContent.appendChild(form);
    modal.appendChild(modalContent);
    
    // 添加到页面
    document.body.appendChild(modal);
    
    // 聚焦第一个输入框
    if (capturedVariableNames.length > 0) {
      inputs[capturedVariableNames[0]].focus();
    }
    
    // 处理取消按钮点击
    cancelButton.addEventListener('click', (e) => {
      e.preventDefault();
      document.body.removeChild(modal);
      resolve({ cancelled: true }); // 返回取消标记而不是原始文本
    });
    
    // 处理确认按钮点击
    confirmButton.addEventListener('click', (e) => {
      e.preventDefault();
      
      // 收集所有输入的值
      let processedText = promptText;
      fullMatchStrings.forEach((fullMatch, index) => { // 使用 fullMatchStrings 进行迭代和替换
        const capturedNameForLookup = capturedVariableNames[index].trim(); // 获取对应捕获组的清理后名称
        const value = inputs[capturedNameForLookup] ? inputs[capturedNameForLookup].value : '';
        // 注意：String.prototype.replace(searchValue, replaceValue) 
        // 如果 searchValue 是字符串，则仅替换第一个匹配项。
        // 为了替换所有相同的占位符，我们需要更复杂的逻辑或确保每个占位符在 fullMatchStrings 中是唯一的实例。
        // 然而，对于典型场景，如果 promptText 是 "你好 {{name}}，再见 {{name}}"
        // fullMatchStrings 会是 ["{{name}}", "{{name}}"]
        // 第一次替换后 processedText 会是 "你好 [value]，再见 {{name}}"
        // 第二次替换 processedText.replace("{{name}}", value) 会替换剩余的 "{{name}}"
        // 这是因为我们是基于原始的 fullMatchStrings 和 capturedVariableNames 来查找和替换的。
        // 一个更简单的方法是循环替换，但可能有效率问题或意外替换。
        // 最好的方式可能是从后往前替换，或者一次性构建新字符串。
        // 为了简单起见，我们暂时保留此逻辑，它适用于多数情况。
        // 如果一个变量在提示词中多次出现，此方法会将它们全部替换为用户输入的值。
        
        // 一个更安全的方式是只替换特定实例，但这需要更复杂的索引或唯一标记。
        // 鉴于目前的结构，我们假定每个 fullMatchStrings[index] 对应 promptText 中的一个特定实例，
        // 并且我们希望所有同名变量都被同一个值替换。
        // 此处的 replace(fullMatch, value) 在循环中，如果 fullMatch 相同，后续的 replace 会在前一次替换的基础上进行。
        // 如果模板是 "A{{var}}B{{var}}C", fullMatchStrings 是 ["{{var}}", "{{var}}"]
        // 第一次: processedText becomes "A<val>B{{var}}C"
        // 第二次: processedText.replace("{{var}}", value) acts on "A<val>B{{var}}C", so becomes "A<val>B<val>C"
        // 这是期望的行为。
        processedText = processedText.replace(new RegExp(escapeRegExp(fullMatch), 'g'), value);

      });
      
      document.body.removeChild(modal);
      resolve(processedText);
    });
    
    // 处理ESC键关闭
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', escHandler);
        resolve({ cancelled: true }); // 返回取消标记而不是原始文本
      }
    });
    
    // 处理回车键提交
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmButton.click();
      }
    });
  });
}

// 辅助函数：转义正则表达式特殊字符
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\\\]]/g, '\\$&'); // $&表示整个被匹配的字符串
}

// 在全局范围存储活跃元素
let activeElement = null;
let activeElementRect = null;


// 处理来自后台脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openPromptSelector") {
    // 保存当前活跃的输入元素
    const currentActiveElement = document.activeElement;
    
    // 检查当前活跃元素是否为输入框
    if (currentActiveElement && 
        (currentActiveElement.tagName === 'INPUT' || 
         currentActiveElement.tagName === 'TEXTAREA' || 
         currentActiveElement.isContentEditable)) {
      
      // 保存当前活跃的输入元素
      window.activeElement = currentActiveElement;
      activeElement = currentActiveElement;
      activeElementRect = currentActiveElement.getBoundingClientRect();
      
      // 获取提示词列表并显示在输入框附近
      chrome.runtime.sendMessage({ action: "getPromptsList" }, (response) => {
        if (response && response.prompts) {
          showPromptSelector(currentActiveElement, response.prompts);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: "无法获取提示词列表" });
        }
      });
      
      return true; // 异步响应
    } else {
      // 没有活跃的输入元素
      sendResponse({ success: false, error: "没有活跃的输入元素" });
    }
    
    return true;
  }
  
  if (message.action === "insertPromptContent") {
    try {
      // 使用async/await处理Promise
      (async () => {
        const processedResult = await processVariables(message.prompt.content);
        
        // 检查是否取消了操作
        if (processedResult && processedResult.cancelled) {
          console.log("用户取消了变量输入");
          sendResponse({ success: false, cancelled: true });
          return; // 如果取消了，直接返回，不执行后续插入操作
        }
        
        // 获取处理后的内容
        const processedPrompt = processedResult.cancelled ? null : processedResult;
        
        // 如果没有内容（被取消），则不执行后续操作
        if (!processedPrompt) {
          sendResponse({ success: false, cancelled: true });
          return;
        }
        
        // 尝试获取活跃元素
        let currentActiveElement = document.activeElement;
        
        // 如果没有活跃元素或活跃元素不是输入框，尝试使用保存的活跃元素
        if (!currentActiveElement || 
            (currentActiveElement.tagName !== 'INPUT' && 
             currentActiveElement.tagName !== 'TEXTAREA' && 
             !currentActiveElement.isContentEditable)) {
          currentActiveElement = window.activeElement || activeElement;
        }
        
        // 尝试插入文本
        let success = false;
        
        if (currentActiveElement && 
            (currentActiveElement.tagName === 'INPUT' || 
             currentActiveElement.tagName === 'TEXTAREA' || 
             currentActiveElement.isContentEditable)) {
          
          // 根据元素类型插入文本
          if (currentActiveElement.isContentEditable) {
            // 对于contentEditable元素
            currentActiveElement.textContent += processedPrompt;
            success = true;
          } else {
            // 对于input和textarea元素
            const start = currentActiveElement.selectionStart || 0;
            const end = currentActiveElement.selectionEnd || 0;
            const beforeText = currentActiveElement.value.substring(0, start);
            const afterText = currentActiveElement.value.substring(end);
            
            currentActiveElement.value = beforeText + processedPrompt + afterText;
            
            // 设置光标位置
            currentActiveElement.selectionStart = currentActiveElement.selectionEnd = start + processedPrompt.length;
            
            // 触发input事件以通知页面内容已更改
            const event = new Event('input', { bubbles: true });
            currentActiveElement.dispatchEvent(event);
            
            success = true;
          }
          
          // 确保焦点返回到原始输入框
          currentActiveElement.focus();
        }
        
        if (success) {
          showNotification("提示词已插入");
          sendResponse({ success: true });
        } else {
          console.log("没有活跃的输入元素，尝试复制到剪贴板");
          copyToClipboard(processedPrompt);
          sendResponse({ success: false, error: "没有活跃的输入元素，已复制到剪贴板" });
        }
      })();
    } catch (error) {
      console.error("插入提示词时出错:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  if (message.action === "ping") {
    sendResponse({ status: "ok" });
    return true;
  }
  
  if (message.action === "updateSettings") {
    // 更新用户设置
    if (message.settings) {
      userSettings = message.settings;
    }
    sendResponse({ success: true });
    return true;
  }
  
  return true;
});

// 改进的插入文本函数
// 假设这是insertTextToActiveElement函数
function insertTextToActiveElement(text) {
  // 获取当前活跃的元素
  const activeElement = document.activeElement;
  
  // 检查是否有活跃的输入元素
  if (!activeElement || 
      (activeElement.tagName !== 'INPUT' && 
       activeElement.tagName !== 'TEXTAREA' && 
       !activeElement.isContentEditable)) {
    console.error("没有活跃的输入元素");
    return false;
  }
  
  // 根据元素类型插入文本
  if (activeElement.isContentEditable) {
    // 对于contentEditable元素
    activeElement.textContent += text;
    return true;
  } else if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
    // 对于input和textarea元素
    const start = activeElement.selectionStart || 0;
    const end = activeElement.selectionEnd || 0;
    const beforeText = activeElement.value.substring(0, start);
    const afterText = activeElement.value.substring(end);
    
    activeElement.value = beforeText + text + afterText;
    
    // 设置光标位置
    activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
    
    // 触发input事件以通知页面内容已更改
    const event = new Event('input', { bubbles: true });
    activeElement.dispatchEvent(event);
    
    return true;
  }
  
  return false;
}

// 这个函数已被上面的async usePrompt(prompt)替代

// 显示通知
function showNotification(message, type = 'success') {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.className = `prompt-notification ${type === 'success' ? '' : 'error'}`;
  notification.style.position = 'fixed';
  notification.style.zIndex = '10000';
  
  // 如果有保存的输入框位置，在附近显示通知
  if (activeElementRect) {
    notification.style.top = `${activeElementRect.bottom + window.scrollY + 10}px`;
    notification.style.left = `${activeElementRect.left + window.scrollX}px`;
  } else {
    // 否则显示在页面底部中央
    notification.style.bottom = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
  }
  
  document.body.appendChild(notification);
  
  // 2秒后移除通知
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 2000);
}

// 复制到剪贴板
function copyToClipboard(text) {
  // 检查clipboard API是否可用
  if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(text)
      .then(() => {
        console.log("内容已复制到剪贴板");
        showNotification("已复制到剪贴板");
      })
      .catch(err => {
        console.error("复制到剪贴板时出错:", err);
        // 使用备用方法
        fallbackCopy(text);
      });
  } else {
    console.log("Clipboard API不可用，使用备用方法");
    fallbackCopy(text);
  }
}

// 备用复制方法
function fallbackCopy(text) {
  try { 
    // 创建一个临时的文本区域 
    const textArea = document.createElement("textarea"); 
    textArea.value = text; 
    // 确保文本区域在视口内但不可见 
    textArea.style.position = 'fixed'; 
    textArea.style.left = '0'; 
    textArea.style.top = '0'; 
    textArea.style.opacity = '0'; 
    document.body.appendChild(textArea); 
    textArea.focus(); 
    textArea.select(); 
    
    const success = document.execCommand('copy'); 
    document.body.removeChild(textArea); 
    
    if (success) { 
      console.log("使用传统方法复制成功"); 
      showNotification("已复制到剪贴板");
    } else { 
      console.error("传统复制方法也失败了"); 
      showNotification("无法复制到剪贴板，请检查浏览器权限", "error");
      // 显示手动复制区域
      showManualCopyArea(text);
    } 
  } catch (fallbackErr) { 
    console.error("所有复制方法都失败了:", fallbackErr); 
    showNotification("无法复制到剪贴板，请检查浏览器权限", "error");
    // 显示手动复制区域
    showManualCopyArea(text);
  } 
}

// 显示手动复制区域
function showManualCopyArea(text) {
  // 创建一个模态框
  const modal = document.createElement('div');
  modal.className = 'manual-copy-modal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modal.style.zIndex = '10001';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'manual-copy-content';
  modalContent.style.padding = '24px';
  modalContent.style.maxWidth = '80%';
  modalContent.style.width = '500px';
  
  const title = document.createElement('h3');
  title.textContent = '请手动复制以下内容';
  title.className = 'manual-copy-title';
  title.style.marginTop = '0';
  title.style.marginBottom = '16px';
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '关闭';
  closeBtn.className = 'manual-copy-button';
  closeBtn.style.float = 'right';
  closeBtn.onclick = function() {
    document.body.removeChild(modal);
  };
  
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.className = 'manual-copy-textarea';
  textarea.style.width = '100%';
  textarea.style.height = '150px';
  textarea.style.marginBottom = '16px';
  textarea.style.padding = '12px';
  textarea.onclick = function() {
    this.select();
  };
  
  modalContent.appendChild(closeBtn);
  modalContent.appendChild(title);
  modalContent.appendChild(textarea);
  modal.appendChild(modalContent);
  
  document.body.appendChild(modal);
  
  // 自动选中文本
  textarea.select();
  
  // 添加ESC键关闭功能
  function handleEsc(e) {
    if (e.key === 'Escape') {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', handleEsc);
    }
  }
  document.addEventListener('keydown', handleEsc);
}

// 添加样式
const style = document.createElement('style');
style.textContent = `
  /* CSS变量 - 主题色 */
  :root {
    /* 浅色模式 */
    --bg-primary: rgba(250, 250, 250, 0.85);
    --bg-secondary: rgba(255, 255, 255, 0.8);
    --bg-tertiary: rgba(240, 240, 240, 0.9);
    --text-primary: #333;
    --text-secondary: #666;
    --text-muted: #888;
    --border-color: rgba(0, 0, 0, 0.1);
    --accent-color: #3a7bec;
    --accent-hover: #2561c9;
    --shadow-color: rgba(0, 0, 0, 0.1);
    --backdrop-blur: 10px;
    --scrollbar-thumb: rgba(0, 0, 0, 0.2);
    --scrollbar-track: rgba(0, 0, 0, 0.05);
    --scrollbar-width: 6px;
    --success-color: rgba(76, 175, 80, 0.9);
    --error-color: rgba(244, 67, 54, 0.9);
  }

  /* 深色模式 */
  @media (prefers-color-scheme: dark) {
    :root {
      --bg-primary: rgba(32, 32, 36, 0.85);
      --bg-secondary: rgba(40, 40, 45, 0.8);
      --bg-tertiary: rgba(50, 50, 55, 0.9);
      --text-primary: #e0e0e0;
      --text-secondary: #b0b0b0;
      --text-muted: #808080;
      --border-color: rgba(255, 255, 255, 0.1);
      --accent-color: #4e85f0;
      --accent-hover: #6899f8;
      --shadow-color: rgba(0, 0, 0, 0.3);
      --success-color: rgba(76, 175, 80, 0.85);
      --error-color: rgba(244, 67, 54, 0.85);
    }
  }

  /* 自定义滚动条样式 */
  ::-webkit-scrollbar {
    width: var(--scrollbar-width);
    height: var(--scrollbar-width);
  }

  ::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
    border-radius: var(--scrollbar-width);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: var(--scrollbar-width);
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--accent-color);
  }

  .prompt-selector-popup {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 8px 24px var(--shadow-color);
    max-height: 400px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    backdrop-filter: blur(var(--backdrop-blur));
    -webkit-backdrop-filter: blur(var(--backdrop-blur));
    animation: fadeInScale 0.2s ease-out;
  }
  
  @keyframes fadeInScale {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  
  .prompt-search-container {
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .prompt-search-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 14px;
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  
  .prompt-search-input:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(74, 133, 240, 0.25);
  }
  
  .prompt-selector-list {
    overflow-y: auto;
    max-height: 340px;
    padding: 8px;
  }
  
  .prompt-selector-item {
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 8px;
    background-color: var(--bg-tertiary);
    border: 1px solid transparent;
    transition: all 0.2s ease;
    position: relative; /* Ensure child absolute positioning is relative to this */
  }
  
  .prompt-selector-item:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px var(--shadow-color);
    border-color: var(--border-color);
  }
  
  .prompt-selector-item:last-child {
    margin-bottom: 0;
  }
  
  .prompt-selector-title {
    font-weight: 600;
    margin-bottom: 6px;
    color: var(--text-primary);
  }
  
  /* 新增: 快捷选择器中的图片预览容器 */
  .prompt-selector-image-preview-container {
    display: none; /* 默认隐藏 */
    margin-top: 8px;
    margin-bottom: 8px;
    text-align: center;
  }

  .prompt-selector-item:hover .prompt-selector-image-preview-container {
    display: block; /* 悬停时显示 */
  }

  /* 新增: 快捷选择器中的图片样式 */
  .prompt-selector-image-preview {
    max-width: 100%;
    max-height: 100px; /* 限制预览高度，避免过大 */
    border-radius: 6px;
    border: 1px solid var(--border-color);
    object-fit: cover;
  }
  
  .prompt-selector-preview {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 通知样式 */
  .prompt-notification {
    background-color: var(--success-color);
    color: white;
    border-radius: 8px;
    padding: 12px 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-weight: 500;
    backdrop-filter: blur(var(--backdrop-blur));
    -webkit-backdrop-filter: blur(var(--backdrop-blur));
    border: 1px solid var(--border-color);
    animation: slideIn 0.3s ease-out, fadeOut 0.3s ease-in 1.7s forwards;
  }
  
  .prompt-notification.error {
    background-color: var(--error-color);
  }
  
  @keyframes slideIn {
    from { transform: translateY(-20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  /* 手动复制模态框样式 */
  .manual-copy-modal {
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
  }

  .manual-copy-content {
    background-color: var(--bg-secondary);
    border-radius: 16px;
    border: 1px solid var(--border-color);
    box-shadow: 0 10px 30px var(--shadow-color);
    color: var(--text-primary);
    animation: slideUp 0.3s ease-out;
    backdrop-filter: blur(var(--backdrop-blur));
    -webkit-backdrop-filter: blur(var(--backdrop-blur));
  }

  .manual-copy-title {
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 10px;
  }

  .manual-copy-textarea {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
  }

  .manual-copy-button {
    background-color: var(--accent-color);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .manual-copy-button:hover {
    background-color: var(--accent-hover);
  }

  @keyframes slideUp {
    from { transform: translateY(30px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

document.head.appendChild(style);

// 渲染提示词列表中高亮变量
function highlightVariables(content) {
  const startEscaped = userSettings.variableFormat.start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const endEscaped = userSettings.variableFormat.end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const variableRegex = new RegExp(startEscaped + '(.+?)' + endEscaped, 'g');
  
  return content.replace(variableRegex, 
    `<span class="variable">${userSettings.variableFormat.start}$1${userSettings.variableFormat.end}</span>`);
}