// 全局变量
let config = null;
let templates = [];
// let apiEndpoints = {}; // 移除 API 端点全局变量
let currentTemplateId = null;
let currentSelectedTemplateElement = null; // 用于跟踪当前选中的模板卡片
let originalPromptTextarea = null; // Declare globally
// let currentApiId = null; // 移除当前 API ID 全局变量

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
  // 获取DOM元素
  const backBtn = document.getElementById('backBtn');
  const optimizeBtn = document.getElementById('optimizeBtn');
  const copyBtn = document.getElementById('copyBtn');
  const saveBtn = document.getElementById('saveBtn');
  const iterateBtn = document.getElementById('iterateBtn');
  const closeModalBtns = document.querySelectorAll('.close');
  
  // 模板相关元素
  // const templateSelector = document.getElementById('templateSelector'); // 移除旧的选择器
  const addTemplateBtn = document.getElementById('addTemplateBtn'); // 这是主添加按钮
  // const editTemplateBtn = document.getElementById('editTemplateBtn'); // 将在卡片内
  // const deleteTemplateBtn = document.getElementById('deleteTemplateBtn'); // 将在卡片内
  const importTemplatesBtn = document.getElementById('importTemplatesBtn');
  const exportTemplatesBtn = document.getElementById('exportTemplatesBtn');
  const templateSearchInput = document.getElementById('templateSearchInput');
  const templatesListContainer = document.getElementById('templatesListContainer');
  const selectedTemplatePreview = document.getElementById('selectedTemplatePreview');

  const templateModal = document.getElementById('templateModal');
  const templateForm = document.getElementById('templateForm');
  const cancelTemplateBtn = document.getElementById('cancelTemplateBtn');
  
  // 新增：选择已有提示词相关元素
  originalPromptTextarea = document.getElementById('originalPrompt'); // Initialize global variable
  const selectExistingPromptBtn = document.getElementById('selectExistingPromptBtn');
  const selectExistingPromptModal = document.getElementById('selectExistingPromptModal');
  const closeSelectExistingPromptModalBtn = document.getElementById('closeSelectExistingPromptModalBtn');
  const existingPromptSearchInput = document.getElementById('existingPromptSearchInput');
  const existingPromptsListContainerForSelection = document.getElementById('existingPromptsListContainerForSelection');
  let allUserPrompts = []; // 用于存储从storage加载的所有提示词

  // API配置相关元素 - 全部移除
  // const apiSelector = document.getElementById('apiSelector');
  // const addApiBtn = document.getElementById('addApiBtn');
  // const editApiBtn = document.getElementById('editApiBtn');
  // const deleteApiBtn = document.getElementById('deleteApiBtn');
  // const apiModal = document.getElementById('apiModal');
  // const apiForm = document.getElementById('apiForm');
  // const cancelApiBtn = document.getElementById('cancelApiBtn');
  
  // 加载配置
  loadConfig();
  
  // 设置事件监听器
  backBtn.addEventListener('click', navigateBack);
  optimizeBtn.addEventListener('click', optimizePrompt);
  copyBtn.addEventListener('click', copyOptimizedPrompt);
  saveBtn.addEventListener('click', saveAsNewPrompt);
  iterateBtn.addEventListener('click', iterateOptimization);
  
  // 关闭模态框按钮
  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      templateModal.style.display = 'none';
      // apiModal.style.display = 'none'; // 移除 API 模态框相关
    });
  });
  
  // 模板相关事件监听器
  addTemplateBtn.addEventListener('click', () => openTemplateModal());
  importTemplatesBtn.addEventListener('click', importOptimizationTemplates);
  exportTemplatesBtn.addEventListener('click', exportOptimizationTemplates);
  templateSearchInput.addEventListener('input', renderTemplatesList); // 搜索时重新渲染列表
  
  templateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveTemplate();
  });
  
  cancelTemplateBtn.addEventListener('click', () => {
    templateModal.style.display = 'none';
  });
  
  // 新增：选择已有提示词模态框事件监听
  if (selectExistingPromptBtn) {
    selectExistingPromptBtn.addEventListener('click', openSelectExistingPromptModal);
  }
  if (closeSelectExistingPromptModalBtn) {
    closeSelectExistingPromptModalBtn.addEventListener('click', () => {
      if (selectExistingPromptModal) selectExistingPromptModal.style.display = 'none';
    });
  }
  if (existingPromptSearchInput) {
    existingPromptSearchInput.addEventListener('input', renderExistingPromptsForSelection);
  }
  
  // API配置相关事件监听器 - 全部移除
  // apiSelector.addEventListener('change', () => {
  //   currentApiId = apiSelector.value;
  // });
  // 
  // addApiBtn.addEventListener('click', () => openApiModal());
  // editApiBtn.addEventListener('click', () => {
  //   if (currentApiId) {
  //     const api = apiEndpoints[currentApiId];
  //     if (api) {
  //       openApiModal(api, currentApiId);
  //     }
  //   } else {
  //     showNotification('请先选择一个API配置', 'error');
  //   }
  // });
  // 
  // deleteApiBtn.addEventListener('click', () => {
  //   if (currentApiId) {
  //     if (confirm('确定要删除此API配置吗？')) {
  //       deleteApiConfig(currentApiId);
  //     }
  //   } else {
  //     showNotification('请先选择一个API配置', 'error');
  //   }
  // });
  // 
  // apiForm.addEventListener('submit', (e) => {
  //   e.preventDefault();
  //   saveApiConfig();
  // });
  // 
  // cancelApiBtn.addEventListener('click', () => {
  //   apiModal.style.display = 'none';
  // });
});

// 添加消息监听器处理流式更新
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 确保消息是来自 background 脚本（可选但推荐）
  // if (sender.id !== chrome.runtime.id) return;

  const outputDiv = document.getElementById('optimizedResultOutput');
  const optimizeBtn = document.getElementById('optimizeBtn');
  const resultContainer = document.querySelector('.result-container');
  const loadingIndicator = document.getElementById('loadingIndicator'); // 获取加载指示器

  if (message.action === "streamUpdate") {
    if (loadingIndicator && loadingIndicator.style.display !== 'none') {
      loadingIndicator.style.display = 'none'; // 收到第一个块时隐藏加载指示器
      if (outputDiv) outputDiv.style.display = 'block'; // 显示输出区域
    }
    if (outputDiv) {
      // 附加新的内容块，注意处理 Markdown 或换行符
      // 简单的追加文本内容
      outputDiv.textContent += message.chunk;
      // 如果需要渲染 Markdown，可以使用库如 marked.js
      // outputDiv.innerHTML += marked.parseInline(message.chunk); // 示例
      
      // 确保结果区域可见
      if (resultContainer) resultContainer.style.display = 'block';
      // 滚动到底部
      outputDiv.scrollTop = outputDiv.scrollHeight;
    }
  } else if (message.action === "streamComplete") {
    if (optimizeBtn) {
        optimizeBtn.textContent = '优化提示词'; // 恢复按钮文本
        optimizeBtn.disabled = false; // 启用按钮
    }
    if (loadingIndicator) loadingIndicator.style.display = 'none'; // 确保加载指示器隐藏
    if (outputDiv && outputDiv.textContent.trim() === '' && !message.finalContent) {
        // 如果流结束但没有内容，并且 finalContent 也没有，则显示提示
        outputDiv.textContent = '未能获取到优化结果。';
        outputDiv.style.display = 'block';
    } else if (outputDiv && outputDiv.style.display === 'none') {
        // 如果之前因为没有数据而隐藏了，现在有数据了就显示它
        outputDiv.style.display = 'block';
    }
    console.log("Stream finished. Final content length:", message.finalContent?.length);
  } else if (message.action === "streamError") {
    if (optimizeBtn) {
        optimizeBtn.textContent = '优化提示词'; // 恢复按钮文本
        optimizeBtn.disabled = false; // 启用按钮
    }
    if (loadingIndicator) loadingIndicator.style.display = 'none'; // 确保加载指示器隐藏
    if (outputDiv) {
        outputDiv.style.display = 'block'; // 确保输出区域可见以显示错误（如果需要）
        // 可以选择在这里显示错误，或者依赖 showNotification
        // outputDiv.textContent = `优化出错: ${message.error}`;
    }
    showNotification(`优化出错: ${message.error}`, 'error');
    // 可以选择隐藏结果区域
    // if (resultContainer) resultContainer.style.display = 'none'; 
  }
});

// 加载配置
function loadConfig() {
  chrome.storage.local.get('config', (data) => {
    if (data.config && data.config.promptOptimization) {
      config = data.config;
    } else {
      // 使用默认配置（之前是从config.json加载）
      const defaultConfig = {
        "promptOptimization": {
          "enabled": true,
          "userSettings": {
            "variableFormat": {
              "start": "{{",
              "end": "}}"
            },
            "triggerCommand": "\\p",
            "openrouterApiKey": "",
            "openrouterModel": "",
            "temperature": 0.7,
            "topP": 0.7
          },
          // API Endpoints 移除了，因为 background.js 直接从 userSettings 读取
          "optimizationTemplates": [
            {
              "id": "general",
              "name": "通用优化",
              "template": "请帮我优化以下提示词，使其更加清晰、具体和有效。保持原始意图不变，但提高其质量和可能的响应质量。\n\n原始提示词：\n{{originalPrompt}}\n\n优化后的提示词："
            },
            {
              "id": "instruction",
              "name": "指令型优化",
              "template": "请将以下提示词优化为更有效的指令型提示词。添加明确的步骤、具体的要求和期望的输出格式。\n\n原始提示词：\n{{originalPrompt}}\n\n优化后的提示词："
            },
            {
              "id": "creative",
              "name": "创意写作优化",
              "template": "请优化以下创意写作提示词，使其能够激发更丰富的想象力和创造性回应。添加更多细节、情感元素和风格指导。\n\n原始提示词：\n{{originalPrompt}}\n\n优化后的提示词："
            },
            {
              "id": "structured_role",
              "name": "结构化角色优化",
              "template": "你是一个专业的AI提示词优化专家。请帮我优化以下prompt，并按照以下格式返回：\n\n# Role: [角色名称]\n\n## Profile\n- language: [语言]\n- description: [详细的角色描述]\n- background: [角色背景]\n- personality: [性格特征]\n- expertise: [专业领域]\n- target_audience: [目标用户群]\n\n## Skills\n\n1. [核心技能类别]\n   - [具体技能]: [简要说明]\n   - [具体技能]: [简要说明]\n   - [具体技能]: [简要说明]\n   - [具体技能]: [简要说明]\n\n2. [辅助技能类别]\n   - [具体技能]: [简要说明]\n   - [具体技能]: [简要说明]\n   - [具体技能]: [简要说明]\n   - [具体技能]: [简要说明]\n\n## Rules\n\n1. [基本原则]：\n   - [具体规则]: [详细说明]\n   - [具体规则]: [详细说明]\n   - [具体规则]: [详细说明]\n   - [具体规则]: [详细说明]\n\n2. [行为准则]：\n   - [具体规则]: [详细说明]\n   - [具体规则]: [详细说明]\n   - [具体规则]: [详细说明]\n   - [具体规则]: [详细说明]\n\n3. [限制条件]：\n   - [具体限制]: [详细说明]\n   - [具体限制]: [详细说明]\n   - [具体限制]: [详细说明]\n   - [具体限制]: [详细说明]\n\n## Workflows\n\n- 目标: [明确目标]\n- 步骤 1: [详细说明]\n- 步骤 2: [详细说明]\n- 步骤 3: [详细说明]\n- 预期结果: [说明]\n\n## Initialization\n作为[角色名称]，你必须遵守上述Rules，按照Workflows执行任务。\n\n请基于以上模板，优化并扩展以下prompt，确保内容专业、完整且结构清晰，注意不要携带任何引导词或解释，不要使用代码块包围：\n\n原始提示词：\n{{originalPrompt}}\n\n优化后的提示词："
            },
            {
              "id": "structured_with_output",
              "name": "结构化带输出格式优化",
              "template": "你是一个专业的AI提示词优化专家。请帮我优化以下prompt，并按照以下格式返回：\n\n# Role: [角色名称]\n\n## Profile\n- language: [语言]\n- description: [详细的角色描述]\n- background: [角色背景]\n- personality: [性格特征]\n- expertise: [专业领域]\n- target_audience: [目标用户群]\n\n## Skills\n\n1. [核心技能类别]\n   - [具体技能]: [简要说明]\n   - [具体技能]: [简要说明]\n   - [具体技能]: [简要说明]\n   - [具体技能]: [简要说明]\n\n2. [辅助技能类别]\n   - [具体技能]: [简要说明]\n   - [具体技能]: [简要说明]\n   - [具体技能]: [简要说明]\n   - [具体技能]: [简要说明]\n\n## Rules\n\n1. [基本原则]：\n   - [具体规则]: [详细说明]\n   - [具体规则]: [详细说明]\n   - [具体规则]: [详细说明]\n   - [具体规则]: [详细说明]\n\n2. [行为准则]：\n   - [具体规则]: [详细说明]\n   - [具体规则]: [详细说明]\n   - [具体规则]: [详细说明]\n   - [具体规则]: [详细说明]\n\n3. [限制条件]：\n   - [具体限制]: [详细说明]\n   - [具体限制]: [详细说明]\n   - [具体限制]: [详细说明]\n   - [具体限制]: [详细说明]\n\n## Workflows\n\n- 目标: [明确目标]\n- 步骤 1: [详细说明]\n- 步骤 2: [详细说明]\n- 步骤 3: [详细说明]\n- 预期结果: [说明]\n\n## OutputFormat\n\n1. [输出格式类型]：\n   - format: [格式类型，如text/markdown/json等]\n   - structure: [输出结构说明]\n   - style: [风格要求]\n   - special_requirements: [特殊要求]\n\n2. [格式规范]：\n   - indentation: [缩进要求]\n   - sections: [分节要求]\n   - highlighting: [强调方式]\n\n3. [验证规则]：\n   - validation: [格式验证规则]\n   - constraints: [格式约束条件]\n   - error_handling: [错误处理方式]\n\n4. [示例说明]：\n   1. 示例1：\n      - 标题: [示例名称]\n      - 格式类型: [对应格式类型]\n      - 说明: [示例的特别说明]\n      - 示例内容: |\n          [具体示例内容]\n   \n   2. 示例2：\n      - 标题: [示例名称]\n      - 格式类型: [对应格式类型] \n      - 说明: [示例的特别说明]\n      - 示例内容: |\n          [具体示例内容]\n\n## Initialization\n作为[角色名称]，你必须遵守上述Rules，按照Workflows执行任务，并按照[输出格式]输出。\n\n请基于以上模板，优化并扩展以下prompt，确保内容专业、完整且结构清晰，注意不要携带任何引导词或解释，不要使用代码块包围：\n\n原始提示词：\n{{originalPrompt}}\n\n优化后的提示词："
            },
            {
              "id": "structured_with_suggestions",
              "name": "带建议的结构化优化",
              "template": "# Role:Prompt工程师\n\n## Attention：\n- 我总是被老板骂写不出来Prompt，如果你能写出优秀的Prompt会避免让我失业，请认真思考并竭尽全力，拜托了！\n\n## Profile:\n- Author:pp\n- Version:2.1\n- Language:中文\n- Description:你是一名优秀的Prompt工程师，擅长将常规的Prompt转化为结构化的Prompt，并输出符合预期的回复。\n\n### Skills:\n- 了解LLM的技术原理和局限性，包括它的训练数据、构建方式等，以便更好地设计Prompt。\n- 具有丰富的自然语言处理经验，能够设计出符合语法、语义的高质量Prompt。\n- 迭代优化能力强，能通过不断调整和测试Prompt的表现，持续改进Prompt质量。\n- 能结合具体业务需求设计Prompt，使LLM生成的内容符合业务要求。\n- Use irregular sentence lengths between8-36 words. Introduce logical confusion and unpredictability in the language. The goal is maximum engagement, complexity, and surprise.\n\n## Goals：\n- 分析用户的Prompt，设计一个结构清晰、符合逻辑的Prompt框架，确保分析过程符合各个学科的最佳实践。\n- 按照<OutputFormat>填充该框架，生成一个高质量的Prompt。\n- 每个结构必须输出5个建议。\n- 确保输出Initialization内容后再结束。\n\n## Constrains:\n1. 你将分析下面这些信息，确保所有内容符合各个学科的最佳实践。\n    - Role: 分析用户的Prompt，思考最适合扮演的1个或多个角色，该角色是这个领域最资深的专家，也最适合解决我的问题。\n    - Background：分析用户的Prompt，思考用户为什么会提出这个问题，陈述用户提出这个问题的原因、背景、上下文。\n    - Attention：分析用户的Prompt，思考用户对这项任务的渴求，并给予积极向上的情绪刺激。\n    - Profile：基于你扮演的角色，简单描述该角色。\n    - Skills：基于你扮演的角色，思考应该具备什么样的能力来完成任务。\n    - Goals：分析用户的Prompt，思考用户需要的任务清单，完成这些任务，便可以解决问题。\n    - Constrains：基于你扮演的角色，思考该角色应该遵守的规则，确保角色能够出色的完成任务。\n    - OutputFormat: 基于你扮演的角色，思考应该按照什么格式进行输出是清晰明了具有逻辑性。\n    - Workflow: 基于你扮演的角色，拆解该角色执行任务时的工作流，生成不低于5个步骤，其中要求对用户提供的信息进行分析，并给与补充信息建议。\n    - Suggestions：基于我的问题(Prompt)，思考我需要提给chatGPT的任务清单，确保角色能够出色的完成任务。\n2. 在任何情况下都不要跳出角色。\n3. 不要胡说八道和编造事实。\n\n## Workflow:\n1. 分析用户输入的Prompt，提取关键信息。\n2. 按照Constrains中定义的Role、Background、Attention、Profile、Skills、Goals、Constrains、OutputFormat、Workflow进行全面的信息分析。\n3. 将分析的信息按照<OutputFormat>输出。\n4. 以markdown语法输出，不要用代码块包围。\n\n## Suggestions:\n1. 明确指出这些建议的目标对象和用途，例如\"以下是一些可以提供给用户以帮助他们改进Prompt的建议\"。\n2. 将建议进行分门别类，比如\"提高可操作性的建议\"、\"增强逻辑性的建议\"等，增加结构感。\n3. 每个类别下提供3-5条具体的建议，并用简单的句子阐述建议的主要内容。\n4. 建议之间应有一定的关联和联系，不要是孤立的建议，让用户感受到这是一个有内在逻辑的建议体系。\n5. 避免空泛的建议，尽量给出针对性强、可操作性强的建议。\n6. 可考虑从不同角度给建议，如从Prompt的语法、语义、逻辑等不同方面进行建议。\n7. 在给建议时采用积极的语气和表达，让用户感受到我们是在帮助而不是批评。\n8. 最后，要测试建议的可执行性，评估按照这些建议调整后是否能够改进Prompt质量。\n\n## OutputFormat:\n    # Role：你的角色名称\n    \n    ## Background：角色背景描述\n    \n    ## Attention：注意要点\n    \n    ## Profile：\n    - Author: 作者名称\n    - Version: 0.1\n    - Language: 中文\n    - Description: 描述角色的核心功能和主要特点\n    \n    ### Skills:\n    - 技能描述1\n    - 技能描述2\n    ...\n    \n    ## Goals:\n    - 目标1\n    - 目标2\n    ...\n\n    ## Constrains:\n    - 约束条件1\n    - 约束条件2\n    ...\n\n    ## Workflow:\n    1. 第一步，xxx\n    2. 第二步，xxx\n    3. 第三步，xxx\n    ...\n\n    ## OutputFormat:\n    - 格式要求1\n    - 格式要求2\n    ...\n    \n    ## Suggestions:\n    - 优化建议1\n    - 优化建议2\n    ...\n\n    ## Initialization\n    作为<Role>，你必须遵守<Constrains>，使用默认<Language>与用户交流。\n\n## Initialization：\n    我会给出Prompt，请根据我的Prompt，慢慢思考并一步一步进行输出，直到最终输出优化的Prompt。\n    请避免讨论我发送的内容，只需要输出优化后的Prompt，不要输出多余解释或引导词，不要使用代码块包围。\n\n原始提示词：\n{{originalPrompt}}\n\n优化后的提示词："
            },
            {
              "id": "instruction_tags",
              "name": "指令标签优化",
              "template": "# Role: 结构化提示词转换专家\n\n## Profile:\n- Author: prompt-optimizer\n- Version: 1.0.3\n- Language: 中文\n- Description: 专注于将普通提示词转换为结构化标签格式，提高提示词的清晰度和有效性。\n\n## Background:\n- 普通提示词往往缺乏清晰的结构和组织\n- 结构化标签格式能够帮助AI更好地理解任务\n- 用户需要将普通指令转换为标准化的结构\n- 正确的结构可以提高任务完成的准确性和效率\n\n## Skills:\n1. 核心分析能力\n   - 提取任务: 准确识别提示词中的核心任务\n   - 背景保留: 完整保留原始提示词内容\n   - 指令提炼: 将隐含指令转化为明确步骤\n   - 输出规范化: 定义清晰的输出格式要求\n\n2. 结构化转换能力\n   - 语义保留: 确保转换过程不丢失原始语义\n   - 结构优化: 将混杂内容分类到恰当的标签中\n   - 细节补充: 基于任务类型添加必要的细节\n   - 格式标准化: 遵循一致的标签格式规范\n\n## Rules:\n\n1. 标签结构规范:\n   - 标签完整性: 必须包含<task>、<context>、<instructions>和<output_format>四个基本标签\n   - 标签顺序: 遵循标准顺序，先任务，后上下文，再指令，最后输出格式\n   - 标签间空行: 每个标签之间必须有一个空行\n   - 格式一致: 所有标签使用尖括号<>包围，保持格式统一\n\n2. 内容转换规则:\n   - 任务简洁化: <task>标签内容应简明扼要，一句话描述核心任务\n   - 原文保留: <context>标签必须完整保留原始提示词的原文内容，保持原始表述，不得重新组织或改写\n   - 指令结构化: <instructions>标签内容应使用有序列表呈现详细步骤，包括必要的子项缩进\n   - 输出详细化: <output_format>标签必须明确指定期望的输出格式和要求\n\n3. 格式细节处理:\n   - 有序列表: 指令步骤使用数字加点的格式（1. 2. 3.）\n   - 子项缩进: 子项使用三个空格缩进并以短横线开始\n   - 段落换行: 标签内部段落之间使用空行分隔\n   - 代码引用: 使用反引号标记代码，不带语言标识\n\n## Workflow:\n1. 分析原始提示词，理解其核心意图和关键要素\n2. 提取核心任务，形成<task>标签内容\n3. 将原始提示词的文字内容直接复制到<context>标签中，保持原文格式和表述\n4. 基于原始提示词，提炼详细的执行步骤，形成<instructions>标签内容\n5. 明确输出格式要求，形成<output_format>标签内容\n6. 按照指定格式组合所有标签内容，形成完整的结构化提示词\n7. 检查格式是否符合要求，特别是标签之间的空行和列表格式\n\n## Initialization:\n我会给出普通格式的提示词，请将其转换为结构化标签格式。\n\n输出时请使用以下精确格式，注意<context>标签中必须保留原始提示词的原文：\n\n<optimized_prompt>\n<task>任务描述</task>\n\n<context>\n原始提示词内容，保持原文不变\n可以是多行\n</context>\n\n<instructions>\n1. 第一步指令\n2. 第二步指令\n3. 第三步指令，可能包含子项：\n   - 子项一\n   - 子项二\n   - 子项三\n4. 第四步指令\n5. 第五步指令\n</instructions>\n\n<output_format>\n期望的输出格式描述\n</output_format>\n</optimized_prompt>\n\n注意：必须按照上述精确格式输出，不要添加任何引导语或解释，不要使用代码块包围输出内容。<context>标签中必须保留原始提示词的完整原文，不得重新组织或改写。\n\n原始提示词：\n{{originalPrompt}}\n\n优化后的提示词："
            },
            {
              "id": "iterative_optimization",
              "name": "迭代优化",
              "template": "# Role：提示词迭代优化专家\n\n## Background：\n- 用户已经有一个优化过的提示词\n- 用户希望在此基础上进行特定方向的改进\n- 需要保持原有提示词的核心意图\n- 同时融入用户新的优化需求\n\n## Profile：\n- Author: prompt-optimizer\n- Version: 1.0\n- Language: 中文\n- Description: 专注于提示词迭代优化，在保持原有提示词核心意图的基础上，根据用户的新需求进行定向优化。\n\n### Skills:\n- 深入理解提示词结构和意图\n- 精准把握用户新的优化需求\n- 在保持核心意图的同时进行改进\n- 确保优化后的提示词更加完善\n- 避免过度修改导致偏离原意\n\n## Goals：\n- 分析原有提示词的核心意图和结构\n- 理解用户新的优化需求\n- 在保持核心意图的基础上进行优化\n- 确保优化结果符合用户期望\n- 提供清晰的优化说明\n\n## Constrains:\n1. 必须保持原有提示词的核心意图\n2. 优化改动要有针对性，避免无关修改\n3. 确保修改符合用户的优化需求\n4. 避免过度修改导致提示词效果降低\n5. 保持提示词的可读性和结构性\n6. 只需要输出优化后的Prompt，使用原有格式，不要输出多余解释或引导词\n7. 优化需求是针对原始提示词的\n\n## Workflow:\n1. 分析原有提示词，提取核心意图和关键结构\n2. 理解用户的优化需求，确定优化方向\n3. 在保持核心意图的基础上对原始提示词进行定向优化\n4. 检查优化结果是否符合预期\n5. 输出优化后的提示词，不要输出多余解释或引导词\n\n## Initialization：\n我会给出原始提示词和优化需求，请根据我的优化需求，在保持核心意图的基础上对原始提示词进行定向优化。\n请避免讨论我发送的内容，只需要输出优化后的Prompt，使用原有格式，不要输出多余解释或引导词。\n\n原始提示词：\n{{originalPrompt}}\n\n优化需求：\n提供更具体、更详细的步骤和指导，增加专业性和可操作性。\n\n优化后的提示词："
            }
          ]
        }
      };
      
      config = defaultConfig;
      chrome.storage.local.set({ config });
    }
    
    // 确保用户设置项存在
    if (!config.promptOptimization.userSettings) {
      config.promptOptimization.userSettings = {
        "variableFormat": {
          "start": "{{",
          "end": "}}"
        },
        "triggerCommand": "\\p"
      };
      chrome.storage.local.set({ config });
    }
    
    // 确保 temperature 和 topP 也存在于 userSettings
    if (typeof config.promptOptimization.userSettings.temperature === 'undefined') {
      config.promptOptimization.userSettings.temperature = 0.7;
    }
    if (typeof config.promptOptimization.userSettings.topP === 'undefined') {
      config.promptOptimization.userSettings.topP = 0.7;
    }
    chrome.storage.local.set({ config }); // 确保更新后的默认值被保存
    
    // 初始化模板和API端点
    if (config && config.promptOptimization) {
      templates = config.promptOptimization.optimizationTemplates || [];
      // apiEndpoints = config.promptOptimization.apiEndpoints || {}; // 移除 API 端点加载
      
      // 填充模板选择器 - 改为渲染模板列表
      renderTemplatesList();
      
      // 填充API选择器 - 移除
      // populateApiSelector(); 
    }
  });
}

// 填充模板选择器 - 改名为 renderTemplatesList 并重写
function renderTemplatesList() {
  const templatesListContainer = document.getElementById('templatesListContainer');
  const templateSearchInput = document.getElementById('templateSearchInput');
  const selectedTemplatePreview = document.getElementById('selectedTemplatePreview');
  
  if (!templatesListContainer) return;
  templatesListContainer.innerHTML = ''; // 清空现有列表

  const searchTerm = templateSearchInput.value.toLowerCase();

  const filteredTemplates = templates.filter(template => 
    template.name.toLowerCase().includes(searchTerm) || 
    template.id.toLowerCase().includes(searchTerm)
  );

  if (filteredTemplates.length === 0) {
    templatesListContainer.innerHTML = '<p class="no-templates-message">没有找到匹配的模板。您可以添加新模板或调整搜索条件。</p>';
    if (selectedTemplatePreview) selectedTemplatePreview.value = ''; // 清空预览
    currentTemplateId = null;
    if(currentSelectedTemplateElement) {
        currentSelectedTemplateElement.classList.remove('selected');
        currentSelectedTemplateElement = null;
    }
    return;
  }

  filteredTemplates.forEach(template => {
    const templateCard = document.createElement('div');
    templateCard.className = 'template-card';
    templateCard.dataset.templateId = template.id;

    const templateNameEl = document.createElement('h4');
    templateNameEl.textContent = template.name;
    templateNameEl.title = `ID: ${template.id}`;

    const templateActions = document.createElement('div');
    templateActions.className = 'template-card-actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = '编辑';
    editBtn.className = 'btn small action-btn';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // 防止触发卡片点击
      openTemplateModal(template);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '删除';
    deleteBtn.className = 'btn small action-btn danger';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // 防止触发卡片点击
      if (confirm(`确定要删除模板 "${template.name}" 吗？`)) {
        deleteTemplate(template.id);
      }
    });

    templateActions.appendChild(editBtn);
    templateActions.appendChild(deleteBtn);

    templateCard.appendChild(templateNameEl);
    templateCard.appendChild(templateActions);

    templateCard.addEventListener('click', () => {
      if (currentSelectedTemplateElement) {
        currentSelectedTemplateElement.classList.remove('selected');
      }
      templateCard.classList.add('selected');
      currentSelectedTemplateElement = templateCard;
      currentTemplateId = template.id;
      if (selectedTemplatePreview) selectedTemplatePreview.value = template.template;
    });

    templatesListContainer.appendChild(templateCard);

    // 如果当前卡片是之前选中的，则重新高亮并更新预览
    if (template.id === currentTemplateId) {
        templateCard.classList.add('selected');
        currentSelectedTemplateElement = templateCard;
        if (selectedTemplatePreview) selectedTemplatePreview.value = template.template;
    }
  });

  // 如果删除了当前选中的模板，或者搜索后当前选中的模板不见了，则清空预览
  if (currentTemplateId && !filteredTemplates.find(t => t.id === currentTemplateId)) {
    if (selectedTemplatePreview) selectedTemplatePreview.value = '';
    currentTemplateId = null;
    if(currentSelectedTemplateElement) {
        currentSelectedTemplateElement.classList.remove('selected');
        currentSelectedTemplateElement = null;
    }
  }
}

// 填充API选择器 - 移除此函数
// function populateApiSelector() {
//   const apiSelector = document.getElementById('apiSelector');
//   apiSelector.innerHTML = '';
//   
//   Object.keys(apiEndpoints).forEach(apiId => {
//     const api = apiEndpoints[apiId];
//     const option = document.createElement('option');
//     option.value = apiId;
//     option.textContent = api.name || apiId;
//     apiSelector.appendChild(option);
//   });
//   
//   if (Object.keys(apiEndpoints).length > 0) {
//     currentApiId = Object.keys(apiEndpoints)[0];
//   }
// }

// 打开模板编辑模态框
function openTemplateModal(template = null) {
  const templateModal = document.getElementById('templateModal');
  const templateModalTitle = document.getElementById('templateModalTitle');
  const templateId = document.getElementById('templateId');
  const templateName = document.getElementById('templateName');
  const templateContent = document.getElementById('templateContent');
  
  if (template) {
    // 编辑现有模板
    templateModalTitle.textContent = '编辑优化模板';
    templateId.value = template.id;
    templateId.disabled = true; // 不允许修改ID
    templateName.value = template.name;
    templateContent.value = template.template;
  } else {
    // 添加新模板
    templateModalTitle.textContent = '添加优化模板';
    templateId.value = '';
    templateId.disabled = false;
    templateName.value = '';
    templateContent.value = '';
  }
  
  templateModal.style.display = 'block';
}

// 保存模板
function saveTemplate() {
  const templateId = document.getElementById('templateId').value;
  const templateName = document.getElementById('templateName').value;
  const templateContent = document.getElementById('templateContent').value;
  
  if (!templateId || !templateName || !templateContent) {
    showNotification('请填写所有必填字段', 'error');
    return;
  }
  
  // 检查ID是否已存在（仅在添加新模板时）
  const existingIndex = templates.findIndex(t => t.id === templateId);
  
  if (existingIndex >= 0 && !document.getElementById('templateId').disabled) {
    showNotification('模板ID已存在，请使用其他ID', 'error');
    return;
  }
  
  const newTemplate = {
    id: templateId,
    name: templateName,
    template: templateContent
  };
  
  if (existingIndex >= 0) {
    // 更新现有模板
    templates[existingIndex] = newTemplate;
  } else {
    // 添加新模板
    templates.push(newTemplate);
  }
  
  // 更新配置并保存
  config.promptOptimization.optimizationTemplates = templates;
  chrome.storage.local.set({ config }, () => {
    renderTemplatesList();
    document.getElementById('templateModal').style.display = 'none';
    showNotification('模板已保存');
    
    // 自动选中新保存/编辑的模板
    currentTemplateId = templateId;
    // 触发一次列表渲染来高亮显示
    renderTemplatesList();
    const newlySelectedCard = document.querySelector(`.template-card[data-template-id="${templateId}"]`);
    if (newlySelectedCard) {
        if (currentSelectedTemplateElement) {
            currentSelectedTemplateElement.classList.remove('selected');
        }
        newlySelectedCard.classList.add('selected');
        currentSelectedTemplateElement = newlySelectedCard;
        const selectedTemplatePreview = document.getElementById('selectedTemplatePreview');
        if (selectedTemplatePreview) {
            const t = templates.find(item => item.id === templateId);
            if (t) selectedTemplatePreview.value = t.template;
        }
    }
  });
}

// 删除模板
function deleteTemplate(templateIdToDelete) {
  const index = templates.findIndex(t => t.id === templateIdToDelete);
  
  if (index >= 0) {
    templates.splice(index, 1);
    
    // 更新配置并保存
    config.promptOptimization.optimizationTemplates = templates;
    chrome.storage.local.set({ config }, () => {
      renderTemplatesList();
      showNotification('模板已删除');
      
      // 如果删除的是当前选中的模板，则清空选择和预览
      if (currentTemplateId === templateIdToDelete) {
        currentTemplateId = null;
        const selectedTemplatePreview = document.getElementById('selectedTemplatePreview');
        if (selectedTemplatePreview) selectedTemplatePreview.value = '';
        if(currentSelectedTemplateElement) {
            currentSelectedTemplateElement.classList.remove('selected');
            currentSelectedTemplateElement = null;
        }
      }
    });
  }
}

// 导入优化模板
function importOptimizationTemplates() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedTemplates = JSON.parse(e.target.result);
          if (Array.isArray(importedTemplates)) {
            // 简单合并，如果ID已存在则跳过，或者可以提供更复杂的合并策略
            let importedCount = 0;
            importedTemplates.forEach(imported => {
              if (imported && imported.id && imported.name && imported.template) {
                if (!templates.find(t => t.id === imported.id)) {
                  templates.push(imported);
                  importedCount++;
                } else {
                  console.warn(`模板ID "${imported.id}" 已存在，跳过导入。`);
                }
              }
            });
            config.promptOptimization.optimizationTemplates = templates;
            chrome.storage.local.set({ config }, () => {
              renderTemplatesList();
              showNotification(`成功导入 ${importedCount} 个新模板。已存在的模板被跳过。`);
            });
          } else {
            showNotification('导入失败：JSON文件格式不正确，期望得到一个数组。', 'error');
          }
        } catch (error) {
          showNotification(`导入失败：${error.message}`, 'error');
        }
        document.body.removeChild(fileInput);
      };
      reader.onerror = () => {
        showNotification('读取文件失败。', 'error');
        document.body.removeChild(fileInput);
      };
      reader.readAsText(file);
    } else {
      document.body.removeChild(fileInput); // 如果没有选择文件也移除input
    }
  });

  fileInput.click();
}

// 导出优化模板
function exportOptimizationTemplates() {
  if (templates.length === 0) {
    showNotification('没有模板可导出。', 'warning');
    return;
  }
  const exportData = JSON.stringify(templates, null, 2);
  const blob = new Blob([exportData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prompt-optimization-templates-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification('模板已导出。');
}

// 返回侧边栏主页
function navigateBack() {
  chrome.sidePanel.setOptions({ path: 'sidepanel.html' });
}

// 优化提示词
function optimizePrompt() {
  const originalPrompt = document.getElementById('originalPrompt').value;
  const selectedTemplateId = currentTemplateId;
  const outputDiv = document.getElementById('optimizedResultOutput');
  const resultContainer = document.querySelector('.result-container');
  const loadingIndicator = document.getElementById('loadingIndicator'); // 获取加载指示器
  
  if (!originalPrompt) {
    showNotification('请输入原始提示词', 'error');
    return;
  }
  
  if (!selectedTemplateId || !templates.find(t => t.id === selectedTemplateId)) {
    showNotification('请先从列表中选择一个有效的优化模板', 'error');
    return;
  }
  
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  
  // 清空之前的输出并准备按钮
  if (outputDiv) outputDiv.textContent = ''; // 清空输出区域
  if (resultContainer) resultContainer.style.display = 'block'; // 确保结果容器可见
  if (loadingIndicator) loadingIndicator.style.display = 'block'; // 显示加载指示器
  if (outputDiv) outputDiv.style.display = 'none'; // 隐藏旧的输出区域
  
  const optimizeBtn = document.getElementById('optimizeBtn');
  optimizeBtn.textContent = '优化中...';
  optimizeBtn.disabled = true;
  
  // 发送优化请求到 background
  chrome.runtime.sendMessage({
    action: "optimizePrompt",
    data: {
      originalPrompt,
      template: selectedTemplate.template
    }
  }, (response) => {
    // 这个回调现在只处理启动流式传输时的错误
    if (chrome.runtime.lastError) {
      // 处理发送消息本身的错误
      optimizeBtn.textContent = '优化提示词';
      optimizeBtn.disabled = false;
      showNotification(`发送请求失败: ${chrome.runtime.lastError.message}`, 'error');
      return;
    }
    if (response && !response.success) {
      // 处理 background 脚本返回的启动错误
      optimizeBtn.textContent = '优化提示词';
      optimizeBtn.disabled = false;
      showNotification(response.error || '启动优化时发生未知错误', 'error');
    }
    // 成功启动流式传输后，按钮状态和结果显示由 streamUpdate/streamComplete/streamError 消息处理
  });
}

// 复制优化后的提示词
function copyOptimizedPrompt() {
  const outputDiv = document.getElementById('optimizedResultOutput');
  if (!outputDiv || !outputDiv.textContent) {
      showNotification('没有可复制的内容', 'error');
      return;
  }
  const optimizedPrompt = outputDiv.textContent;
  navigator.clipboard.writeText(optimizedPrompt)
    .then(() => {
      showNotification('已复制到剪贴板');
    })
    .catch(err => {
      console.error('复制失败:', err);
      showNotification('复制失败，请检查浏览器权限', 'error');
    });
}

// 保存为新提示词
function saveAsNewPrompt() {
  const outputDiv = document.getElementById('optimizedResultOutput');
  if (!outputDiv || !outputDiv.textContent) {
      showNotification('没有可保存的优化结果', 'error');
      return;
  }
  const optimizedPrompt = outputDiv.textContent;
  
  // 创建一个新的提示词对象
  const newPrompt = {
    id: Date.now().toString(),
    title: '优化的提示词 - ' + new Date().toLocaleString(),
    content: optimizedPrompt,
    createdAt: new Date().toISOString()
  };
  
  chrome.storage.local.get('prompts', (data) => {
    const prompts = data.prompts || [];
    prompts.push(newPrompt);
    
    chrome.storage.local.set({ prompts }, () => {
      showNotification('已保存为新提示词');
    });
  });
}

// 继续优化
function iterateOptimization() {
  const outputDiv = document.getElementById('optimizedResultOutput');
  if (!outputDiv || !outputDiv.textContent) {
      showNotification('没有可继续优化的结果', 'error');
      return;
  }
  const optimizedPrompt = outputDiv.textContent;
  
  // 将优化结果设置为新的原始提示词
  document.getElementById('originalPrompt').value = optimizedPrompt;
  
  // 清空结果区域
  outputDiv.textContent = '';
  document.querySelector('.result-container').style.display = 'none';
  
  // 自动触发优化
  optimizePrompt();
}

// 显示
function showNotification(message, type = 'success') {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.className = `prompt-notification ${type === 'success' ? '' : 'error'}`;
  notification.style.position = 'fixed';
  notification.style.bottom = '20px';
  notification.style.right = '20px';
  notification.style.padding = '12px 16px';
  notification.style.borderRadius = '8px';
  notification.style.backgroundColor = type === 'success' ? 'rgba(76, 175, 80, 0.9)' : 'rgba(244, 67, 54, 0.9)';
  notification.style.color = 'white';
  notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  notification.style.zIndex = '10000';
  notification.style.fontWeight = '500';
  notification.style.animation = 'fadeIn 0.3s, fadeOut 0.3s 1.7s forwards';
  
  // 添加动画样式
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  // 2秒后移除通知
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
    if (document.head.contains(style)) {
      document.head.removeChild(style);
    }
  }, 2000);
}

// 新增：打开选择已有提示词模态框
async function openSelectExistingPromptModal() {
  if (!selectExistingPromptModal) return;

  try {
    const data = await new Promise((resolve) => {
      chrome.storage.local.get('prompts', resolve);
    });
    allUserPrompts = data.prompts || [];
    renderExistingPromptsForSelection();
    selectExistingPromptModal.style.display = 'block';
    if (existingPromptSearchInput) existingPromptSearchInput.focus();
  } catch (error) {
    console.error("加载已有提示词失败:", error);
    showNotification("加载已有提示词失败", "error");
  }
}

// 新增：渲染已有提示词列表以供选择
function renderExistingPromptsForSelection() {
  if (!existingPromptsListContainerForSelection || !allUserPrompts) return;

  existingPromptsListContainerForSelection.innerHTML = ''; // 清空列表
  const searchTerm = existingPromptSearchInput ? existingPromptSearchInput.value.toLowerCase() : '';

  const filteredPrompts = allUserPrompts.filter(p => 
    (p.title && p.title.toLowerCase().includes(searchTerm)) || 
    (p.content && p.content.toLowerCase().includes(searchTerm))
  );

  if (filteredPrompts.length === 0) {
    existingPromptsListContainerForSelection.innerHTML = '<p class="no-prompts-message">没有找到匹配的提示词。</p>';
    return;
  }

  filteredPrompts.forEach(prompt => {
    const promptItem = document.createElement('div');
    promptItem.className = 'existing-prompt-item-for-selection'; // 使用特定类名
    
    const titleEl = document.createElement('h5');
    titleEl.textContent = prompt.title || '无标题';
    promptItem.appendChild(titleEl);

    const contentPreview = document.createElement('p');
    contentPreview.className = 'content-preview';
    contentPreview.textContent = prompt.content ? (prompt.content.substring(0, 100) + (prompt.content.length > 100 ? '...' : '')) : '无内容';
    promptItem.appendChild(contentPreview);

    promptItem.addEventListener('click', () => {
      console.log('[Optimize.js] Clicked on existing prompt item. Prompt object:', JSON.parse(JSON.stringify(prompt))); // Log a deep copy of the prompt
      console.log('[Optimize.js] originalPromptTextarea element:', originalPromptTextarea);

      if (originalPromptTextarea) {
        console.log(`[Optimize.js] Current textarea value BEFORE: "${originalPromptTextarea.value}"`);
        console.log(`[Optimize.js] Attempting to set textarea value to: "${prompt.content}"`);
        
        originalPromptTextarea.value = ''; // 先清空
        originalPromptTextarea.value = prompt.content; // 再赋值
        
        console.log(`[Optimize.js] Textarea value AFTER direct assignment: "${originalPromptTextarea.value}"`);

        // 强制失焦再聚焦，有时能触发UI更新
        originalPromptTextarea.blur();
        originalPromptTextarea.focus(); // 将光标置入，方便用户看到

        // 触发 'input' 和 'change' 事件
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        originalPromptTextarea.dispatchEvent(inputEvent);
        console.log('[Optimize.js] Dispatched input event.');

        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        originalPromptTextarea.dispatchEvent(changeEvent);
        console.log('[Optimize.js] Dispatched change event.');

        // 延迟检查，看看UI是否最终更新
        setTimeout(() => {
          console.log(`[Optimize.js] Textarea value AFTER 100ms delay: "${originalPromptTextarea.value}"`);
        }, 100);

      } else {
        console.error('[Optimize.js] originalPromptTextarea is null or undefined!');
      }
      if (selectExistingPromptModal) {
        selectExistingPromptModal.style.display = 'none';
        console.log('[Optimize.js] Hid selectExistingPromptModal.');
      }
      showNotification(`已选择提示词: "${prompt.title || '无标题'}"`);
    });

    existingPromptsListContainerForSelection.appendChild(promptItem);
  });
}