// 全局配置
let userSettings = {
  variableFormat: {
    start: '{{',
    end: '}}'
  },
  triggerCommand: '\\p'
};

// DOM 元素
const addPromptBtn = document.getElementById('addBtn');
const optimizeBtn = document.getElementById('optimizeBtn');
const importBtn = document.getElementById('importBtn');
const exportBtn = document.getElementById('exportBtn');
const settingsBtn = document.getElementById('settingsBtn');
const analyticsBtn = document.getElementById('analyticsBtn');
const searchInput = document.getElementById('searchInput');
const promptsList = document.getElementById('promptsList');

// 新增：批量操作和排序相关的DOM元素
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

// 新增：文件夹相关DOM元素
const createFolderBtn = document.getElementById('createFolderBtn');
const foldersList = document.getElementById('foldersList');
const promptFolderSelect = document.getElementById('promptFolderSelect');

// 模态框元素
const promptModal = document.getElementById('promptModal');
const settingsModal = document.getElementById('settingsModal');
const modalTitle = document.getElementById('modalTitle');
const promptForm = document.getElementById('promptForm');
const promptTitle = document.getElementById('promptTitle');
const promptContent = document.getElementById('promptContent');
const promptTags = document.getElementById('promptTags');
const promptLink = document.getElementById('promptLink');
const cancelBtn = document.getElementById('cancelBtn');
const closeModalBtns = document.querySelectorAll('.close');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const tagFilterInput = document.getElementById('tagFilterInput');
const sortOrderSelect = document.getElementById('sortOrderSelect');

// 新增: 图片相关元素
const promptImageInput = document.getElementById('promptImage');
const modalImagePreview = document.getElementById('modalImagePreview');
const imageUploadArea = document.getElementById('imageUploadArea');

// 导入导出模态框
const importExportModal = document.getElementById('importExportModal');
const importExportTitle = document.getElementById('importExportTitle');
const importExportData = document.getElementById('importExportData');
const confirmImportExportBtn = document.getElementById('confirmImportExportBtn');
const cancelImportExportBtn = document.getElementById('cancelImportExportBtn');

// 设置表单元素
const variableStartFormat = document.getElementById('variableStartFormat');
const variableEndFormat = document.getElementById('variableEndFormat');
const triggerCommand = document.getElementById('triggerCommand');
const openrouterApiKey = document.getElementById('openrouterApiKey');
const openrouterModel = document.getElementById('openrouterModel');
const testOpenRouterBtn = document.getElementById('testOpenRouterBtn');
const temperatureSetting = document.getElementById('temperatureSetting');
const topPSetting = document.getElementById('topPSetting');

// 当前编辑的提示词 ID
let currentEditId = null;
// 所有提示词数据
let prompts = [];
// 新增：所有文件夹数据
let promptFolders = [];
// 新增：当前选中的文件夹ID
let currentSelectedFolderId = null;
// 新增：用于存储当前选中的提示词ID
let selectedPromptIds = new Set();

// Global variables for pagination
let currentPage = 1;
const promptsPerPage = 20;
let allPrompts = []; // To store all prompts fetched from storage
let currentFilter = ''; // To store the current search/filter term
let currentFolderId = 'all'; // To store the currently selected folder
let isLoading = false; // To prevent multiple loads at the same time
let noMorePrompts = false; // To indicate if all prompts have been loaded

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 已加载，开始初始化...');
  loadUserSettings();
  loadPrompts();
  loadPromptFolders(); // 新增：加载文件夹
  setupEventListeners();
  
  // 更新变量格式提示
  const helpText = document.getElementById('variableFormatHelp');
  if (helpText) {
    chrome.storage.local.get('config', (data) => {
      if (data.config && data.config.promptOptimization && data.config.promptOptimization.userSettings) {
        const format = data.config.promptOptimization.userSettings.variableFormat;
        if (format && format.start && format.end) {
          helpText.textContent = `使用 ${format.start}变量名${format.end} 创建可替换的变量`;
        }
      }
    });
  }

  // 新增：设置 ResizeObserver 来动态调整布局
  if (promptsList) {
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        adjustLayoutBasedOnWidth(width);
      }
    });
    resizeObserver.observe(promptsList);
  }

  const loadMoreContainer = document.getElementById('loadMoreContainer');
  if (loadMoreContainer) {
      loadMoreContainer.style.display = 'none'; // Initially hide load more button
  }
   // Initialize layout based on current width
  adjustLayoutBasedOnWidth(document.documentElement.clientWidth);

  // Observe layout changes
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      adjustLayoutBasedOnWidth(entry.contentRect.width);
    }
  });

  const container = document.querySelector('.container'); // Observe the main container or a specific element
  if (container) {
    resizeObserver.observe(container);
  }
});

// 监听存储变化，自动刷新列表
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.prompts) {
    console.log('检测到提示词存储发生变化，重新加载...');
    loadPrompts(); // 重新加载并渲染提示词列表
  }
  if (namespace === 'local' && changes.promptFolders) { // 新增：监听文件夹变化
    console.log('检测到文件夹存储发生变化，重新加载...');
    loadPromptFolders();
  }
});

// 加载用户设置
function loadUserSettings() {
  chrome.storage.local.get('config', (data) => {
    if (data.config && data.config.promptOptimization && data.config.promptOptimization.userSettings) {
      userSettings = data.config.promptOptimization.userSettings;
      // 确保 openrouterApiKey 和 openrouterModel 字段存在，如果不存在则使用默认空值
      userSettings.openrouterApiKey = userSettings.openrouterApiKey || '';
      userSettings.openrouterModel = userSettings.openrouterModel || '';
      // 初始化 temperature 和 topP，如果不存在
      userSettings.temperature = typeof userSettings.temperature === 'number' ? userSettings.temperature : 0.7;
      userSettings.topP = typeof userSettings.topP === 'number' ? userSettings.topP : 0.7;
    } else {
      // 如果 promptOptimization 或 userSettings 不存在，则创建它们并设置默认值
      userSettings = {
        variableFormat: {
          start: '{{',
          end: '}}'
        },
        triggerCommand: '\\p',
        openrouterApiKey: '',
        openrouterModel: '',
        temperature: 0.7, // 默认值
        topP: 0.7, // 默认值
      };
      if (!data.config) data.config = {};
      if (!data.config.promptOptimization) data.config.promptOptimization = { enabled: true };
      data.config.promptOptimization.userSettings = userSettings;
      chrome.storage.local.set({ config: data.config }); // 保存回存储以确保结构完整
    }
  });
}

// 设置事件监听器
function setupEventListeners() {
  console.log('设置事件监听器...');
  console.log('添加按钮元素:', addPromptBtn);
  console.log('优化按钮元素:', optimizeBtn);
  console.log('导入按钮元素:', importBtn);
  console.log('导出按钮元素:', exportBtn);
  console.log('设置按钮元素:', settingsBtn);
  console.log('统计分析按钮元素:', analyticsBtn);
  
  // 新建提示词按钮
  if (addPromptBtn) {
    addPromptBtn.addEventListener('click', () => {
      console.log('点击了添加按钮');
      openPromptModal();
    });
  } else {
    console.error('添加按钮元素不存在!');
  }
  
  // 新增：创建文件夹按钮
  if (createFolderBtn) {
    createFolderBtn.addEventListener('click', () => {
      showCreateFolderInput();
    });
  } else {
    console.error('创建文件夹按钮不存在!');
  }
  
  // 新增：删除选中按钮事件监听
  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', () => {
      if (selectedPromptIds.size > 0) {
        if (confirm(`确定要删除选中的 ${selectedPromptIds.size} 个提示词吗？`)) {
          deleteSelectedPrompts();
        }
      }
    });
  } else {
    console.error('删除选中按钮元素不存在!');
  }
  
  // 优化提示词按钮
  if (optimizeBtn) {
    optimizeBtn.addEventListener('click', () => {
      console.log('点击了优化按钮');
      chrome.sidePanel.setOptions({ path: 'optimize-panel.html' });
    });
  } else {
    console.error('优化按钮元素不存在!');
  }
  
  // 新增：统计分析按钮
  if (analyticsBtn) {
    analyticsBtn.addEventListener('click', () => {
      console.log('点击了统计分析按钮');
      chrome.sidePanel.setOptions({ path: 'analytics.html' });
    });
  } else {
    console.error('统计分析按钮不存在!');
  }
  
  // 设置按钮
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      console.log('点击了设置按钮');
      openSettings();
    });
  } else {
    console.error('设置按钮元素不存在!');
  }

  // 测试 OpenRouter 按钮
  if (testOpenRouterBtn) {
    testOpenRouterBtn.addEventListener('click', () => {
      console.log('点击了测试 OpenRouter 按钮');
      testOpenRouterApi();
    });
  } else {
    console.error('测试 OpenRouter 按钮元素不存在!');
  }

  // 保存设置按钮
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      console.log('点击了保存设置按钮');
      saveSettings();
    });
  }
  
  // 导入按钮
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      console.log('点击了导入按钮');
      // 创建一个隐藏的文件输入元素
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
      
      // 触发点击事件打开文件选择器
      fileInput.click();
      
      // 监听文件选择事件
      fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const importedData = JSON.parse(e.target.result);
              if (Array.isArray(importedData)) {
                // 直接用导入的数据覆盖现有数据，而不是合并
                prompts = importedData;
                chrome.storage.local.set({ prompts }, () => {
                  renderPromptsList();
                  alert(`成功导入 ${importedData.length} 个提示词，并替换了原有提示词`);
                });
              } else {
                alert('导入失败：数据格式不正确');
              }
            } catch (error) {
              alert(`导入失败：${error.message}`);
            }
            // 移除文件输入元素
            document.body.removeChild(fileInput);
          };
          reader.readAsText(file);
        }
      });
    });
  } else {
    console.error('导入按钮元素不存在!');
  }
  
  // 导出按钮
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      console.log('点击了导出按钮');
      
      // 创建要导出的JSON数据
      const exportData = JSON.stringify(prompts, null, 2);
      
      // 创建Blob对象
      const blob = new Blob([exportData], { type: 'application/json' });
      
      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prompt-sidebar-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      
      // 触发下载
      a.click();
      
      // 清理
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    });
  } else {
    console.error('导出按钮元素不存在!');
  }
  
  // 搜索输入框
  if (searchInput) {
    searchInput.addEventListener('input', renderPromptsList);
  } else {
    console.error('搜索输入框元素不存在!');
  }
  
  // 标签过滤输入框
  if (tagFilterInput) {
    tagFilterInput.addEventListener('input', renderPromptsList);
  } else {
    console.error('标签过滤输入框元素不存在!');
  }
  
  // 新增：排序选择器事件监听
  if (sortOrderSelect) {
    sortOrderSelect.addEventListener('change', renderPromptsList);
  } else {
    console.error('排序选择器元素不存在!');
  }
  
  // 提示词表单提交
  if (promptForm) {
    promptForm.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation(); // 阻止事件冒泡
      console.log('提交表单');
      savePrompt();
    });
  } else {
    console.error('提示词表单元素不存在!');
  }
  
  // 取消按钮
  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // 阻止事件冒泡
      closePromptModal();
    });
  } else {
    console.error('取消按钮元素不存在!');
  }
  
  // 关闭模态框按钮
  if (closeModalBtns.length > 0) {
    closeModalBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e.target.closest('#promptModal')) {
          closePromptModal();
        } else if (e.target.closest('#importExportModal')) {
          closeImportExportModal();
        } else if (e.target.closest('#settingsModal')) {
          closeSettingsModal();
        }
      });
    });
  } else {
    console.error('关闭模态框按钮元素不存在!');
  }
  
  // 导入导出确认按钮
  if (confirmImportExportBtn) {
    confirmImportExportBtn.addEventListener('click', () => {
      if (importExportTitle.textContent === '导入提示词') {
        importPrompts();
      }
      closeImportExportModal();
    });
  } else {
    console.error('导入导出确认按钮元素不存在!');
  }
  
  // 导入导出取消按钮
  if (cancelImportExportBtn) {
    cancelImportExportBtn.addEventListener('click', closeImportExportModal);
  } else {
    console.error('导入导出取消按钮元素不存在!');
  }

  // 新增: 监听图片选择变化
  if (promptImageInput) {
    promptImageInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (modalImagePreview) {
            modalImagePreview.src = e.target.result;
            modalImagePreview.style.display = 'block';
          }
        }
        reader.readAsDataURL(file);
      } else {
        if (modalImagePreview) {
          modalImagePreview.src = '#';
          modalImagePreview.style.display = 'none';
        }
      }
    });
  } else {
    console.error('图片输入元素不存在!');
  }

  // 新增: 拖拽上传事件监听
  if (imageUploadArea) {
    imageUploadArea.addEventListener('dragenter', handleDragEnter, false);
    imageUploadArea.addEventListener('dragover', handleDragOver, false);
    imageUploadArea.addEventListener('dragleave', handleDragLeave, false);
    imageUploadArea.addEventListener('drop', handleDrop, false);
  } else {
    console.error('图片拖拽区域元素不存在!');
  }

  // Add wheel event listener for horizontal scrolling of foldersList
  if (foldersList) {
    foldersList.addEventListener('wheel', (event) => {
      // If the element can be scrolled horizontally
      if (foldersList.scrollWidth > foldersList.clientWidth) {
        // Prevent default vertical scroll page behavior
        event.preventDefault();
        // Adjust scrollLeft based on deltaY (vertical scroll)
        // A small multiplier can be added if scrolling feels too slow/fast
        foldersList.scrollLeft += event.deltaY * 0.5; // Multiplier 0.5 for sensitivity, adjust as needed
      }
      // Allow default behavior for actual horizontal scroll (deltaX)
      // or if the element isn't horizontally scrollable to avoid issues.
    });
  }

  // Debounce function
  function debounce(func, delay) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), delay);
    };
  }

  const debouncedFilter = debounce(() => {
    currentFilter = searchInput.value;
    loadPrompts(1, currentFolderId, currentFilter);
  }, 300); // 300ms debounce

  if (searchInput) {
    searchInput.addEventListener('input', debouncedFilter);
  }

  if (promptFolderSelect) {
    promptFolderSelect.addEventListener('change', (event) => {
      currentFolderId = event.target.value;
      loadPrompts(1, currentFolderId, currentFilter);
    });
  }

  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      if (!isLoading && !noMorePrompts) {
        loadPrompts(currentPage + 1, currentFolderId, currentFilter);
      }
    });
  }
}

// 新增: 拖拽事件处理函数
function handleDragEnter(e) {
  e.preventDefault();
  e.stopPropagation();
  if (imageUploadArea) {
    imageUploadArea.classList.add('dragover-active');
  }
}

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  // 可以选择不在这里重复添加类，dragenter时添加，dragleave时移除即可
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  if (imageUploadArea) {
    imageUploadArea.classList.remove('dragover-active');
  }
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  if (imageUploadArea) {
    imageUploadArea.classList.remove('dragover-active');
  }

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0]; // 只处理第一个文件
    if (file.type.startsWith('image/')) {
      // 更新文件输入框，这样现有的 'change' 事件监听器可以处理预览
      if (promptImageInput) {
        promptImageInput.files = files; // 将拖拽的文件赋值给input.files
        // 手动触发 change 事件
        const event = new Event('change', { bubbles: true });
        promptImageInput.dispatchEvent(event);
      }
    } else {
      alert('请拖入图片文件。');
    }
  }
}

// 加载提示词
async function loadPrompts(page = 1, folderId = 'all', filterText = '') {
  if (isLoading || (noMorePrompts && page > 1 && filterText === currentFilter && folderId === currentFolderId)) {
    console.log("Already loading or no more prompts to load for this filter/folder.");
    updateLoadMoreButtonVisibility(); // Ensure button is correctly hidden if no more prompts
    return;
  }
  isLoading = true;
  currentFilter = filterText;
  currentFolderId = folderId;

  // Show loading indicator
  const promptsListElement = document.getElementById('promptsList');
  const loadMoreContainer = document.getElementById('loadMoreContainer');
  const loadMoreBtn = document.getElementById('loadMoreBtn');

  if (page === 1) {
    promptsListElement.innerHTML = ''; // Clear list only for the first page or new filter/folder
    allPrompts = [];
    noMorePrompts = false;
    currentPage = 1;
  }

  if (loadMoreBtn) loadMoreBtn.textContent = '正在加载...';


  chrome.storage.local.get('prompts', (data) => {
    let promptsToFilter = data.prompts || [];
    allPrompts = promptsToFilter; // Store all prompts for client-side filtering if needed for pagination

    let filteredPrompts = promptsToFilter;

    // Filter by folder
    if (folderId !== 'all') {
      filteredPrompts = filteredPrompts.filter(p => (p.folderId || 'all') === folderId);
    }

    // Filter by text
    if (filterText) {
      const lowerFilterText = filterText.toLowerCase();
      filteredPrompts = filteredPrompts.filter(prompt =>
        (prompt.title && prompt.title.toLowerCase().includes(lowerFilterText)) ||
        (prompt.content && prompt.content.toLowerCase().includes(lowerFilterText)) ||
        (prompt.tags && prompt.tags.some(tag => tag.toLowerCase().includes(lowerFilterText)))
      );
    }
    
    // Sort prompts by creation date (newest first)
    filteredPrompts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const startIndex = (page - 1) * promptsPerPage;
    const endIndex = startIndex + promptsPerPage;
    const promptsForPage = filteredPrompts.slice(startIndex, endIndex);

    if (promptsForPage.length === 0 && page === 1) {
      promptsListElement.innerHTML = '<p class="no-prompts">没有找到匹配的提示词。</p>';
      if (loadMoreContainer) loadMoreContainer.style.display = 'none';
      noMorePrompts = true;
    } else {
      renderPromptsList(promptsForPage, page === 1); // Pass append flag
      currentPage = page;
      if (endIndex >= filteredPrompts.length) {
        noMorePrompts = true;
        if (loadMoreContainer) loadMoreContainer.style.display = 'none';
      } else {
        noMorePrompts = false;
        if (loadMoreContainer) loadMoreContainer.style.display = 'block';
      }
    }
    isLoading = false;
    if (loadMoreBtn) loadMoreBtn.textContent = '加载更多';
    updateLoadMoreButtonVisibility();
    updateBatchActionUI(); // Update batch actions after loading
  });
}

// 新增：加载文件夹
function loadPromptFolders() {
  chrome.storage.local.get('promptFolders', (data) => {
    promptFolders = data.promptFolders || [];
    renderPromptFoldersList(); 
    // 初始加载后，如果文件夹选择器在模态框中，可能需要在打开模态框时填充
  });
}

// 新增：创建新文件夹
function createNewFolder(name) {
  const newFolder = {
    id: Date.now().toString(), // 简单唯一ID
    name: name
  };
  promptFolders.push(newFolder);
  chrome.storage.local.set({ promptFolders }, () => {
    renderPromptFoldersList(); // 重新渲染文件夹列表
    showNotification(`文件夹 "${name}" 已创建`);
  });
}

// 新增：渲染文件夹列表
async function renderPromptFoldersList() {
  const foldersListElement = document.getElementById('foldersList');
  if (!foldersListElement) return;

  // 先获取总的提示词数量，用于"所有提示词"的显示
  const allPromptsData = await new Promise(resolve => chrome.storage.local.get('prompts', resolve));
  const totalPromptsCount = (allPromptsData.prompts || []).length;

  // 创建"所有提示词"的固定项
  const allPromptsWrapper = document.createElement('div');
  allPromptsWrapper.className = 'folder-item-wrapper all-prompts-item';
  if (currentFolderId === 'all') {
    allPromptsWrapper.classList.add('selected');
  }
  allPromptsWrapper.dataset.folderId = 'all';

  const allPromptsItem = document.createElement('div');
  allPromptsItem.className = 'folder-item';
  allPromptsItem.innerHTML = `
    <span class="folder-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
    </span>
    <span class="folder-name-display">所有提示词</span>
  `;
  const allPromptsCountSpan = document.createElement('span');
  allPromptsCountSpan.className = 'folder-item-count';
  allPromptsCountSpan.textContent = totalPromptsCount; // 使用这里获取的总数

  allPromptsItem.appendChild(allPromptsCountSpan);
  allPromptsWrapper.appendChild(allPromptsItem);

  allPromptsWrapper.addEventListener('click', (e) => {
    if (e.target.closest('.folder-action-btn')) return; // 忽略操作按钮的点击
    document.querySelectorAll('.folder-item-wrapper.selected').forEach(el => el.classList.remove('selected'));
    allPromptsWrapper.classList.add('selected');
    currentFolderId = 'all';
    loadPrompts(1, 'all', document.getElementById('searchInput').value);
    updateBatchActionUI();
  });

  foldersListElement.innerHTML = ''; // 清空旧的文件夹列表
  foldersListElement.appendChild(allPromptsWrapper);

  // 加载并渲染用户创建的文件夹
  chrome.storage.local.get('promptFolders', (data) => {
    const folders = data.promptFolders || [];
    folders.sort((a, b) => (a.name || '').localeCompare(b.name || '')); // 按名称排序

    folders.forEach(folder => {
      const folderWrapper = document.createElement('div');
      folderWrapper.className = 'folder-item-wrapper';
      if (folder.id === currentFolderId) {
        folderWrapper.classList.add('selected');
      }
      folderWrapper.dataset.folderId = folder.id;
      folderWrapper.setAttribute('draggable', 'true'); // 使文件夹可拖动

      const folderItem = document.createElement('div');
      folderItem.className = 'folder-item';

      const iconSpan = document.createElement('span');
      iconSpan.className = 'folder-icon';
      iconSpan.innerHTML = folder.icon || '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>'; // 默认文件夹图标
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'folder-name-display';
      nameSpan.textContent = folder.name || '未命名文件夹';
      
      // 计算该文件夹下的提示词数量
      const promptsInFolderCount = (allPromptsData.prompts || []).filter(p => p.folderId === folder.id).length;
      const countSpan = document.createElement('span');
      countSpan.className = 'folder-item-count';
      countSpan.textContent = promptsInFolderCount;

      folderItem.appendChild(iconSpan);
      folderItem.appendChild(nameSpan);
      folderItem.appendChild(countSpan);
      
      const actionsSpan = document.createElement('span');
      actionsSpan.className = 'folder-item-actions';
      actionsSpan.innerHTML = `
        <button class="folder-action-btn edit-folder-btn" title="编辑文件夹">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="folder-action-btn delete-folder-btn danger" title="删除文件夹">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      `;
      folderItem.appendChild(actionsSpan);
      folderWrapper.appendChild(folderItem);

      folderWrapper.addEventListener('click', (e) => {
        if (e.target.closest('.folder-action-btn')) return; // 忽略操作按钮的点击
        
        document.querySelectorAll('.folder-item-wrapper.selected').forEach(el => el.classList.remove('selected'));
        folderWrapper.classList.add('selected');
        currentFolderId = folder.id;
        loadPrompts(1, folder.id, document.getElementById('searchInput').value);
        updateBatchActionUI();
      });
      
      // 编辑按钮事件
      actionsSpan.querySelector('.edit-folder-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // 防止触发文件夹的点击事件
        showInlineFolderEdit(folderWrapper, folder, nameSpan);
      });

      // 删除按钮事件
      actionsSpan.querySelector('.delete-folder-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFolder(folder.id, folder.name);
      });
      
      // 拖放事件监听
      folderWrapper.addEventListener('dragover', handleDragOver);
      folderWrapper.addEventListener('dragenter', handleDragEnter);
      folderWrapper.addEventListener('dragleave', handleDragLeave);
      folderWrapper.addEventListener('drop', (e) => handleDrop(e, folder.id, folder.name));

      foldersListElement.appendChild(folderWrapper);
    });
    
    // 如果没有自定义文件夹，但有提示词，则确保"所有提示词"被选中
    if (folders.length === 0 && totalPromptsCount > 0 && currentFolderId !== 'all') {
        const allPromptsItemToSelect = foldersListElement.querySelector('.all-prompts-item');
        if (allPromptsItemToSelect) {
            allPromptsItemToSelect.click(); // 模拟点击以选中并加载
        }
    } else if (currentFolderId === 'all') {
        const allPromptsItemToSelect = foldersListElement.querySelector('.all-prompts-item');
        if (allPromptsItemToSelect) {
             allPromptsItemToSelect.classList.add('selected');
        }
    }
  });
}

// 新增：显示内联文件夹编辑界面
function showInlineFolderEdit(wrapper, folder, originalFolderItemSpan) {
  // 暂存原始的 folderItem 和 folderActions (如果它们是独立的元素)
  const originalNameSpan = originalFolderItemSpan.querySelector('span:not(.folder-item-count)'); // 获取纯文本部分
  const folderActions = wrapper.querySelector('.folder-item-actions');

  // 隐藏原始名称和操作按钮
  originalFolderItemSpan.style.display = 'none';
  if (folderActions) folderActions.style.display = 'none';

  const editContainer = document.createElement('div');
  editContainer.className = 'folder-edit-inline-container';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = folder.name;
  input.className = 'folder-edit-inline-input';
  
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '保存';
  saveBtn.className = 'btn small primary folder-edit-inline-save';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.className = 'btn small folder-edit-inline-cancel';

  const tempActionsContainer = document.createElement('div');
  tempActionsContainer.className = 'folder-edit-inline-actions';
  tempActionsContainer.appendChild(saveBtn);
  tempActionsContainer.appendChild(cancelBtn);

  editContainer.appendChild(input);
  editContainer.appendChild(tempActionsContainer);
  
  // 插入到原始 folderItemSpan 之后，或者 wrapper 的特定位置
  // 如果 folderActions 存在，则在其之前插入，否则在 wrapper 的末尾
  if (folderActions) {
    wrapper.insertBefore(editContainer, folderActions);
  } else {
    wrapper.appendChild(editContainer);
  }
  input.focus();
  input.select();

  const cleanupAndRestore = () => {
    wrapper.removeChild(editContainer);
    originalFolderItemSpan.style.display = ''; // 恢复显示
    if (folderActions) folderActions.style.display = ''; // 恢复显示
    input.removeEventListener('keydown', handleKeydown);
  };

  const handleSave = () => {
    const newName = input.value.trim();
    if (newName && newName !== folder.name) {
      editFolder(folder.id, newName); // 调用修改后的 editFolder
    }
    cleanupAndRestore();
    // editFolder 内部会调用 renderPromptFoldersList，所以这里不需要重复渲染
  };

  const handleCancel = () => {
    cleanupAndRestore();
  };

  const handleKeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  saveBtn.addEventListener('click', handleSave);
  cancelBtn.addEventListener('click', handleCancel);
  input.addEventListener('keydown', handleKeydown);
}

// 修改：编辑文件夹名称 (不再使用 prompt)
function editFolder(folderId, newName) {
  const folderIndex = promptFolders.findIndex(f => f.id === folderId);
  if (folderIndex !== -1) {
    promptFolders[folderIndex].name = newName; // newName 已经是 trim 过的
    chrome.storage.local.set({ promptFolders }, () => {
      renderPromptFoldersList();
      showNotification(`文件夹名称已更新为 "${newName}"`);
    });
  }
}

// 新增：删除文件夹
function deleteFolder(folderId, folderName) {
  if (confirm(`确定要删除文件夹 "${folderName}" 吗？\n注意：此文件夹中的所有提示词将被移至"未分类"。`)) {
    // 1. 从 promptFolders 数组中移除该文件夹
    promptFolders = promptFolders.filter(f => f.id !== folderId);

    // 2. 处理孤立的提示词
    let modifiedPrompts = false;
    prompts.forEach(p => {
      if (p.folderId === folderId) {
        p.folderId = null; // 或 ''，与未分类的 folderId 一致
        modifiedPrompts = true;
      }
    });

    const updates = { promptFolders };
    if (modifiedPrompts) {
      updates.prompts = prompts;
    }

    chrome.storage.local.set(updates, () => {
      // 3. 如果被删除的文件夹是当前选中的文件夹，则重置选择
      if (currentSelectedFolderId === folderId) {
        currentSelectedFolderId = null;
      }
      renderPromptFoldersList();
      renderPromptsList(); // 因为提示词的文件夹属性可能已更改
      showNotification(`文件夹 "${folderName}" 已删除`);
    });
  }
}

// 删除提示词
function deletePrompt(id) {
  if (confirm('确定要删除这个提示词吗？')) {
    chrome.storage.local.get('prompts', (data) => {
      let latestPrompts = data.prompts || [];
      latestPrompts = latestPrompts.filter(p => p.id !== id);
      prompts = latestPrompts;
      selectedPromptIds.delete(id);
      chrome.storage.local.set({ prompts: latestPrompts }, () => {
        renderPromptsList();
        renderPromptFoldersList(); // 新增：刷新文件夹和总数
        updateBatchActionUI();
      });
    });
  }
}

// 新增：删除选中的提示词
function deleteSelectedPrompts() {
  chrome.storage.local.get('prompts', (data) => {
    let latestPrompts = data.prompts || [];
    latestPrompts = latestPrompts.filter(p => !selectedPromptIds.has(p.id));
    prompts = latestPrompts;
    selectedPromptIds.clear();
    chrome.storage.local.set({ prompts: latestPrompts }, () => {
      renderPromptsList();
      renderPromptFoldersList(); // 新增：刷新文件夹和总数
      updateBatchActionUI();
      showNotification('选中的提示词已删除');
    });
  });
}

// 新增：更新批量操作UI的可见性和状态
function updateBatchActionUI() {
  if (!deleteSelectedBtn) return;

  if (selectedPromptIds.size > 0) {
    deleteSelectedBtn.style.display = 'inline-block'; // Show the button
    deleteSelectedBtn.disabled = false;
    deleteSelectedBtn.textContent = `删除选中 (${selectedPromptIds.size})`;
  } else {
    deleteSelectedBtn.style.display = 'none'; // Hide the button
    deleteSelectedBtn.disabled = true;
    deleteSelectedBtn.textContent = '删除选中';
  }
}

// 高亮变量的函数
function highlightVariables(content) {
  const startEscaped = userSettings.variableFormat.start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const endEscaped = userSettings.variableFormat.end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // 使用更简单和稳健的非贪婪匹配 (.+?) 来捕获变量名
  const variableRegex = new RegExp(startEscaped + '(.+?)' + endEscaped, 'g');
  
  return content.replace(variableRegex, 
    `<span class="variable">${userSettings.variableFormat.start}$1${userSettings.variableFormat.end}</span>`);
}

// 渲染提示词列表
function renderPromptsList(prompts, clearExisting = true) {
  const promptsListElement = document.getElementById('promptsList');
  const fragment = document.createDocumentFragment();

  if (clearExisting) {
    promptsListElement.innerHTML = ''; // Clear only if specified (e.g., for first page load or filter change)
  }

  if (!prompts || prompts.length === 0) {
    if (clearExisting) { // Only show "no prompts" if we've cleared and there are no new ones
        const currentLayout = promptsListElement.className.includes('two-columns') ? 'two-columns' :
                              promptsListElement.className.includes('compact-grid') ? 'compact-grid' : 'list';
        if (currentLayout === 'list') {
            promptsListElement.innerHTML = '<p class="no-prompts">没有可用的提示词。</p>';
        } else {
            // For grid layouts, ensure the container is empty but don't add "no prompts" text directly,
            // as it might interfere with grid styling if items are added later via "load more".
            // The "no prompts" message for initial load is handled in loadPrompts.
        }
    }
    updateLoadMoreButtonVisibility();
    return;
  }

  prompts.forEach(prompt => {
    const promptItem = document.createElement('div');
    promptItem.className = 'prompt-item';
    promptItem.draggable = true; // 新增：使提示词项可拖动
    promptItem.id = `prompt-${prompt.id}`; // 给一个唯一ID方便查找

    // 新增：dragstart 事件
    promptItem.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', prompt.id);
      e.dataTransfer.effectAllowed = 'move';
      promptItem.classList.add('dragging');
      // Store a reference to the dragged element
      draggedPromptElement = promptItem; 
    });

    // 新增：dragend 事件，用于移除拖动样式
    promptItem.addEventListener('dragend', () => {
      promptItem.classList.remove('dragging');
      draggedPromptElement = null; 
      // Clean up any dragover styling on folders
      document.querySelectorAll('.folder-item-wrapper.dragover-target').forEach(el => {
        el.classList.remove('dragover-target');
      });
    });
    
    // 修改卡片点击行为以处理选择
    promptItem.addEventListener('click', () => {
      if (selectedPromptIds.has(prompt.id)) {
        selectedPromptIds.delete(prompt.id);
        promptItem.classList.remove('selected-for-batch'); // Or use 'prompt-item--selected'
      } else {
        selectedPromptIds.add(prompt.id);
        promptItem.classList.add('selected-for-batch'); // Or use 'prompt-item--selected'
      }
      updateBatchActionUI();
    });
    
    // 提示词标题和操作按钮
    const promptHeader = document.createElement('div');
    promptHeader.className = 'prompt-header';
    
    const promptTitle = document.createElement('div');
    promptTitle.className = 'prompt-title';
    promptTitle.textContent = prompt.title;
    
    const promptActions = document.createElement('div');
    promptActions.className = 'prompt-actions';
    
    // 编辑按钮
    const editBtn = document.createElement('button');
    editBtn.className = 'btn small';
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPromptModal(prompt);
    });
    
    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn small';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`确定要删除"${prompt.title}"吗？`)) {
        deletePrompt(prompt.id);
      }
    });
    
    promptActions.appendChild(editBtn);
    promptActions.appendChild(deleteBtn);
    
    promptHeader.appendChild(promptTitle);
    promptHeader.appendChild(promptActions);
    
    // 提示词标签
    if (prompt.tags && prompt.tags.length > 0) {
      const tagsContainer = document.createElement('div');
      tagsContainer.className = 'prompt-tags-container';
      prompt.tags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.className = 'prompt-tag';
        tagElement.textContent = tag;
        tagsContainer.appendChild(tagElement);
      });
      promptItem.appendChild(tagsContainer);
    }
    
    // 提示词内容
    const promptContentElement = document.createElement('div');
    promptContentElement.className = 'prompt-content';
    
    // 在高亮变量前，先移除可能存在的 <style> 标签，防止样式污染
    let sanitizedContent = prompt.content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    // 同时，也移除 <script> 标签以增强安全性
    sanitizedContent = sanitizedContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // 高亮变量
    promptContentElement.innerHTML = highlightVariables(sanitizedContent);
    
    // 新增：显示使用次数
    const usageCountElement = document.createElement('div');
    usageCountElement.className = 'prompt-usage-count';
    usageCountElement.textContent = `使用次数: ${prompt.usageCount || 0}`;
    
    // 提示词底部操作区
    const promptFooter = document.createElement('div');
    promptFooter.className = 'prompt-footer';
    
    const promptFooterActions = document.createElement('div');
    promptFooterActions.className = 'prompt-footer-actions';
    
    // 使用按钮
    const useBtn = document.createElement('button');
    useBtn.className = 'btn small primary';
    useBtn.textContent = '复制';  // 修改为"复制"
    useBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      usePrompt(prompt);
    });
    
    promptFooterActions.appendChild(useBtn);
    
    // 打开链接按钮
    if (prompt.link) {
      const openLinkBtn = document.createElement('button');
      openLinkBtn.className = 'btn small';
      openLinkBtn.textContent = '打开链接';
      openLinkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(prompt.link, '_blank');
      });
      promptFooterActions.appendChild(openLinkBtn);
    }
    
    promptFooter.appendChild(promptFooterActions);
    
    // 组装提示词项目
    promptItem.appendChild(promptHeader);
    promptItem.appendChild(promptContentElement);
    promptItem.appendChild(usageCountElement); // 添加使用次数显示
    promptItem.appendChild(promptFooter);

    // 新增: 提示词图片预览 (如果存在) - 移动到卡片底部
    if (prompt.imagePreviewUrl) {
      const imagePreviewContainer = document.createElement('div');
      imagePreviewContainer.className = 'prompt-item-image-preview-container';
      const imagePreview = document.createElement('img');
      imagePreview.src = prompt.imagePreviewUrl;
      imagePreview.alt = prompt.title + ' 预览';
      imagePreview.className = 'prompt-item-image-preview';
      imagePreviewContainer.appendChild(imagePreview);
      promptItem.appendChild(imagePreviewContainer); // Append after promptFooter
    }
    
    fragment.appendChild(promptItem);
  });

  promptsListElement.appendChild(fragment);
  updateBatchActionUI();
  updateLoadMoreButtonVisibility();
}

// 打开提示词编辑模态框
function openPromptModal(prompt = null) {
  console.log('打开提示词模态框:', prompt);
  
  // 设置模态框标题
  modalTitle.textContent = prompt ? '编辑提示词' : '新建提示词';
  
  // 填充文件夹下拉列表
  if (promptFolderSelect) {
    promptFolderSelect.innerHTML = '<option value="">未分类</option>'; // 清空并添加默认选项
    promptFolders.forEach(folder => {
      const option = document.createElement('option');
      option.value = folder.id;
      option.textContent = folder.name;
      promptFolderSelect.appendChild(option);
    });
  }

  // 如果是编辑模式，填充表单
  if (prompt) {
    promptTitle.value = prompt.title;
    promptContent.value = prompt.content;
    promptTags.value = prompt.tags ? prompt.tags.join('#') : '';
    promptLink.value = prompt.link || '';
    if (promptFolderSelect) promptFolderSelect.value = prompt.folderId || ''; // 预选文件夹
    currentEditId = prompt.id;

    // 新增: 处理图片预览
    if (prompt.imagePreviewUrl && modalImagePreview) {
      modalImagePreview.src = prompt.imagePreviewUrl;
      modalImagePreview.style.display = 'block';
    } else if (modalImagePreview) {
      modalImagePreview.src = '#';
      modalImagePreview.style.display = 'none';
    }
  } else {
    // 如果是新建模式，清空表单
    promptTitle.value = '';
    promptContent.value = '';
    promptTags.value = '';
    promptLink.value = '';
    currentEditId = null;
    // 新增: 重置图片预览
    if (modalImagePreview) {
      modalImagePreview.src = '#';
      modalImagePreview.style.display = 'none';
    }
  }
  // 新增: 重置文件输入框的值
  if (promptImageInput) {
    promptImageInput.value = ''; 
  }
  
  // 显示模态框
  promptModal.style.display = 'block';
  
  // 聚焦标题输入框
  promptTitle.focus();
}

// 保存提示词
async function savePrompt() {
  console.log('保存提示词...');
  // 获取表单数据
  let title = promptTitle.value.trim();
  let content = promptContent.value.trim();
  const tagsString = promptTags.value.trim();
  const link = promptLink.value.trim();
  const folderId = promptFolderSelect ? promptFolderSelect.value : '';
  if (!title || !content) {
    alert('标题和内容不能为空');
    return;
  }
  let imagePreviewUrl = null;
  const imageFile = promptImageInput.files[0];
  if (imageFile) {
    try {
      imagePreviewUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });
    } catch (error) {
      console.error("读取图片文件失败:", error);
      alert("读取图片文件失败，请重试。");
      return;
    }
  } else if (currentEditId) {
    // 如果是编辑模式且没有选择新图片，则保留旧图片
    const existingPrompt = prompts.find(p => p.id === currentEditId);
    if (existingPrompt && existingPrompt.imagePreviewUrl) {
      imagePreviewUrl = existingPrompt.imagePreviewUrl;
    }
  }
  // 创建提示词对象
  const prompt = {
    title,
    content,
    tags: tagsString ? tagsString.split('#').map(tag => tag.trim()).filter(tag => tag) : [],
    link: link || null,
    folderId: folderId || null,
    id: currentEditId || Date.now().toString(),
    imagePreviewUrl: imagePreviewUrl,
    createdAt: new Date().toISOString(),
    usageCount: 0
  };
  // 先 get 最新 prompts
  chrome.storage.local.get('prompts', (data) => {
    let latestPrompts = data.prompts || [];
    if (currentEditId) {
      const index = latestPrompts.findIndex(p => p.id === currentEditId);
      if (index !== -1) {
        if (!prompt.createdAt) {
          prompt.createdAt = new Date().toISOString();
        }
        prompt.usageCount = latestPrompts[index].usageCount || 0;
        latestPrompts[index] = prompt;
      }
    } else {
      prompt.createdAt = new Date().toISOString();
      prompt.usageCount = 0;
      latestPrompts.push(prompt);
    }
    prompts = latestPrompts;
    chrome.storage.local.set({ prompts: latestPrompts }, () => {
      console.log('提示词已保存');
      selectedPromptIds.clear();
      renderPromptsList();
      renderPromptFoldersList();
      closePromptModal();
      updateBatchActionUI();
    });
  });
}

// 关闭提示词模态框
function closePromptModal() {
  console.log('关闭提示词模态框');
  promptModal.style.display = 'none';
  // 重置表单
  promptForm.reset();
  currentEditId = null;
  // 新增: 重置图片预览和文件输入
  if (modalImagePreview) {
    modalImagePreview.src = '#';
    modalImagePreview.style.display = 'none';
  }
  if (promptImageInput) {
    promptImageInput.value = '';
  }
}

// 打开导入模态框
function openImportModal() {
  console.log('打开导入模态框');
  importExportTitle.textContent = '导入提示词';
  importExportData.value = '';
  importExportModal.style.display = 'block';
}

// 打开导出模态框
function openExportModal() {
  console.log('打开导出模态框');
  importExportTitle.textContent = '导出提示词';
  importExportData.value = JSON.stringify(prompts, null, 2);
  importExportModal.style.display = 'block';
}

// 关闭导入导出模态框
function closeImportExportModal() {
  console.log('关闭导入导出模态框');
  importExportModal.style.display = 'none';
}

// 导入提示词
function importPrompts() {
  try {
    const importedData = JSON.parse(importExportData.value);
    if (Array.isArray(importedData)) {
      chrome.storage.local.get('prompts', (data) => {
        // 直接覆盖现有数据，不再合并
        prompts = importedData;
        chrome.storage.local.set({ prompts: importedData }, () => {
          renderPromptsList();
          alert(`成功导入 ${importedData.length} 个提示词，并替换了原有提示词`);
        });
      });
    } else {
      alert('导入失败：数据格式不正确');
    }
  } catch (error) {
    alert(`导入失败：${error.message}`);
  }
}

// 过滤提示词
function filterPrompts() { // This function will now be called by the debounced handler
  // The core logic is moved to loadPrompts, triggered by the debounced handler
  // This function can be simplified or removed if direct calls are updated.
  // For now, ensure it calls the new loadPrompts structure.
  const filterText = document.getElementById('searchInput').value;
  const folderId = document.getElementById('promptFolderSelect').value;
  loadPrompts(1, folderId, filterText);
}

// 打开设置模态框
function openSettings() {
  // 填充当前设置
  if (userSettings) {
    if (userSettings.variableFormat) {
      variableStartFormat.value = userSettings.variableFormat.start || '{{';
      variableEndFormat.value = userSettings.variableFormat.end || '}}';
    }
    
    triggerCommand.value = userSettings.triggerCommand || '\\p';
    openrouterApiKey.value = userSettings.openrouterApiKey || '';
    openrouterModel.value = userSettings.openrouterModel || '';
    // 加载 temperature 和 topP
    temperatureSetting.value = typeof userSettings.temperature === 'number' ? userSettings.temperature : 0.7;
    topPSetting.value = typeof userSettings.topP === 'number' ? userSettings.topP : 0.7;
  }
  
  settingsModal.style.display = 'block';
}

// 关闭设置模态框
function closeSettingsModal() {
  settingsModal.style.display = 'none';
}

// 保存用户设置
function saveSettings() {
  // 验证设置
  if (!variableStartFormat.value || !variableEndFormat.value || !triggerCommand.value) {
    showNotification('请填写所有基本设置项', 'error');
    return;
  }
  
  // 获取当前配置
  chrome.storage.local.get('config', (data) => {
    let config = data.config || {};
    
    if (!config.promptOptimization) {
      config.promptOptimization = { enabled: true };
    }
    
    // 准备新的用户设置
    const newSettings = {
      variableFormat: {
        start: variableStartFormat.value,
        end: variableEndFormat.value
      },
      triggerCommand: triggerCommand.value,
      openrouterApiKey: openrouterApiKey.value.trim(),
      openrouterModel: openrouterModel.value.trim(),
      temperature: parseFloat(temperatureSetting.value),
      topP: parseFloat(topPSetting.value)
    };

    // 校验 temperature 和 topP
    if (isNaN(newSettings.temperature) || newSettings.temperature < 0 || newSettings.temperature > 2) {
      showNotification('Temperature 值必须在 0.0 到 2.0 之间。将使用默认值 0.7。', 'error');
      newSettings.temperature = 0.7;
    }
    if (isNaN(newSettings.topP) || newSettings.topP < 0 || newSettings.topP > 1) {
      showNotification('Top P 值必须在 0.0 到 1.0 之间。将使用默认值 0.7。', 'error');
      newSettings.topP = 0.7;
    }

    // 获取旧的变量格式以供比较
    const oldSettings = config.promptOptimization.userSettings || userSettings; // Fallback to global userSettings if not in storage yet
    const oldVariableFormat = oldSettings.variableFormat || { start: '{{', end: '}}' }; // Default if somehow missing

    // 将新的用户设置赋值给 config 对象
    config.promptOptimization.userSettings = newSettings;
    
    // 保存配置
    chrome.storage.local.set({ config }, () => {
      // 更新本地全局变量
      userSettings = { ...newSettings }; // 使用展开运算符确保是新对象
      
      // 向所有内容脚本广播设置更改
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'updateSettings', 
            settings: userSettings 
          }).catch(() => {
            // 忽略任何消息发送错误
          });
        });
      });
      
      // 更新变量格式提示
      const helpText = document.getElementById('variableFormatHelp');
      if (helpText) {
        helpText.textContent = `使用 ${userSettings.variableFormat.start}变量名${userSettings.variableFormat.end} 创建可替换的变量`;
      }
      
      closeSettingsModal();
      showNotification('设置已保存');

      // 检查变量格式是否有变化，如果有，则触发批量更新
      if (oldVariableFormat.start !== newSettings.variableFormat.start || 
          oldVariableFormat.end !== newSettings.variableFormat.end) {
        showNotification('检测到变量格式更改，正在更新所有提示词中的变量格式...', 'info');
        chrome.runtime.sendMessage({
          action: 'batchUpdateVariableFormats',
          data: {
            oldFormat: oldVariableFormat,
            newFormat: newSettings.variableFormat
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            showNotification(`批量更新变量格式时发生错误: ${chrome.runtime.lastError.message}`, 'error');
            console.error("批量更新变量格式时发生错误:", chrome.runtime.lastError.message);
          } else if (response && response.success) {
            showNotification(`成功更新了 ${response.updatedCount} 个提示词的变量格式。`, 'success');
            loadPrompts(); // 重新加载提示词以反映更改
          } else {
            showNotification(`批量更新变量格式失败: ${response.error || '未知错误'}`, 'error');
          }
        });
      }
    });
  });
}

// 测试 OpenRouter API
async function testOpenRouterApi() {
  const apiKey = openrouterApiKey.value.trim();
  const model = openrouterModel.value.trim();

  if (!apiKey) {
    showNotification('请输入 OpenRouter API Key', 'error');
    return;
  }
  if (!model) {
    showNotification('请输入 OpenRouter 模型名称', 'error');
    return;
  }

  showNotification('正在测试 OpenRouter API...', 'info');

  try {
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
            "content": "Hello!"
          }
        ],
        "max_tokens": 10
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        showNotification('OpenRouter API 测试成功！', 'success');
      } else {
        showNotification('OpenRouter API 测试成功，但未返回有效响应。', 'warning');
      }
    } else {
      const errorData = await response.json();
      showNotification(`OpenRouter API 测试失败: ${errorData.error ? errorData.error.message : response.statusText}`, 'error');
    }
  } catch (error) {
    console.error('测试 OpenRouter API 时出错:', error);
    showNotification(`测试 OpenRouter API 时出错: ${error.message}`, 'error');
  }
}

// 使用提示词（复制到剪贴板）
function usePrompt(prompt) {
  // 创建一个模态对话框来处理变量
  const startEscaped = userSettings.variableFormat.start.replace(/[.*+?^${}()|[\\\]]/g, '\\\\$&');
  const endEscaped = userSettings.variableFormat.end.replace(/[.*+?^${}()|[\\\]]/g, '\\\\$&');
  const variableRegex = new RegExp(startEscaped + '(.+?)' + endEscaped, 'g');
  
  const variables = prompt.content.match(variableRegex) || [];
  
  // 如果没有变量，直接复制内容
  if (variables.length === 0) {
    navigator.clipboard.writeText(prompt.content)
      .then(() => {
        showNotification("已复制到剪贴板");
        incrementUsageCount(prompt.id); // 增加使用次数
      })
      .catch(err => {
        console.error('复制失败:', err);
        showNotification("复制失败，请检查浏览器权限", "error");
      });
    return;
  }
  
  // 提取变量名
  const startLength = userSettings.variableFormat.start.length;
  const endLength = userSettings.variableFormat.end.length;
  const variableNames = variables.map(v => v.substring(startLength, v.length - endLength));
  
  // 创建模态对话框
  const modal = document.createElement('div');
  modal.className = 'variables-modal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.zIndex = '10000';
  
  // 创建对话框内容
  const modalContent = document.createElement('div');
  modalContent.className = 'variables-content';
  modalContent.style.backgroundColor = 'var(--bg-secondary)';
  modalContent.style.borderRadius = '12px';
  modalContent.style.padding = '24px';
  modalContent.style.width = '400px';
  modalContent.style.maxWidth = '90%';
  modalContent.style.maxHeight = '80vh';
  modalContent.style.overflowY = 'auto';
  modalContent.style.boxShadow = '0 8px 24px var(--shadow-color)';
  
  // 添加标题
  const title = document.createElement('h3');
  title.textContent = '请输入变量值';
  title.style.marginTop = '0';
  title.style.marginBottom = '16px';
  title.style.color = 'var(--text-primary)';
  modalContent.appendChild(title);
  
  // 创建表单
  const form = document.createElement('form');
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '16px';
  
  // 为每个变量创建输入框
  const inputs = {};

  // 定义预填充值 - 注意：sidepanel 环境可能无法直接访问 window.location.href, document.title, window.getSelection()
  // 这些需要通过 content script 获取，或者在 sidepanel 中提供不同的预填充逻辑
  const predefinedValues = {
    currentDate: new Date().toISOString().split('T')[0],
    currentTime: new Date().toLocaleTimeString(),
    // currentURL: '', // 需要异步获取
    // pageTitle: '', // 需要异步获取
    // selectedText: '' // 需要异步获取
  };

  // 异步获取页面信息，如果需要的话
  // 这部分比较复杂，因为 sidepanel 和 content script 的通信是异步的
  // 为了简化，我们暂时只预填日期和时间，其他的可以后续再考虑如何优雅地实现

  variableNames.forEach(varName => {
    const cleanVarName = varName.trim();
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    
    const label = document.createElement('label');
    label.textContent = cleanVarName;
    label.style.display = 'block';
    label.style.marginBottom = '8px';
    label.style.color = 'var(--text-primary)';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `请输入${cleanVarName}的值...`;
    input.style.width = '100%';
    input.style.padding = '10px 12px';
    input.style.borderRadius = '8px';
    input.style.border = '1px solid var(--border-color)';
    input.style.backgroundColor = 'var(--bg-tertiary)';
    input.style.color = 'var(--text-primary)';
    
    // 预填充逻辑 (仅限 sidepanel 可直接获取的)
    if (predefinedValues.hasOwnProperty(cleanVarName)) {
      input.value = predefinedValues[cleanVarName];
    }

    formGroup.appendChild(label);
    formGroup.appendChild(input);
    form.appendChild(formGroup);
    
    inputs[cleanVarName] = input;
  });
  
  // 添加按钮容器
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'form-actions';
  buttonContainer.style.display = 'flex';
  buttonContainer.style.justifyContent = 'space-between';
  buttonContainer.style.marginTop = '24px';
  
  // 取消按钮
  const cancelButton = document.createElement('button');
  cancelButton.textContent = '取消';
  cancelButton.className = 'btn';
  cancelButton.type = 'button';
  
  // 确认按钮
  const confirmButton = document.createElement('button');
  confirmButton.textContent = '确认';
  confirmButton.className = 'btn primary';
  confirmButton.type = 'button';
  
  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(confirmButton);
  
  form.appendChild(buttonContainer);
  modalContent.appendChild(form);
  modal.appendChild(modalContent);
  
  // 添加到页面
  document.body.appendChild(modal);
  
  // 聚焦第一个输入框
  if (variableNames.length > 0) {
    inputs[variableNames[0]].focus();
  }
  
  // 处理取消按钮点击
  cancelButton.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  // 处理确认按钮点击
  confirmButton.addEventListener('click', () => {
    // 收集所有输入的值
    let processedContent = prompt.content;
    variables.forEach((variable, index) => {
      const originalVarNameExtracted = variableNames[index];
      const lookupKeyForInput = originalVarNameExtracted.trim();
      const value = inputs[lookupKeyForInput] ? inputs[lookupKeyForInput].value : '';
      processedContent = processedContent.replace(variable, value);
    });
    
    // 复制到剪贴板
    navigator.clipboard.writeText(processedContent)
      .then(() => {
        showNotification("已复制到剪贴板");
        incrementUsageCount(prompt.id); // 增加使用次数
      })
      .catch(err => {
        console.error('复制失败:', err);
        showNotification("复制失败，请检查浏览器权限", "error");
      });
    
    document.body.removeChild(modal);
  });
  
  // 处理ESC键关闭
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape' && document.body.contains(modal)) {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', escHandler);
    }
  });
  
  // 处理回车键提交
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmButton.click();
    }
  });
}

// 显示通知
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

// 新增：增加提示词使用次数的函数
function incrementUsageCount(promptId) {
  const promptIndex = prompts.findIndex(p => p.id === promptId);
  if (promptIndex !== -1) {
    prompts[promptIndex].usageCount = (prompts[promptIndex].usageCount || 0) + 1;
    prompts[promptIndex].lastUsedAt = new Date().toISOString(); // 同时更新最后使用时间
    chrome.storage.local.set({ prompts: prompts }, () => {
      // 可选：如果希望列表在使用后立即根据"使用次数"排序更新，可以在这里调用 renderPromptsList()
      // 但要注意，如果用户当前不是按使用次数排序，这可能会改变列表顺序，带来不好的体验。
      // 一个折衷的办法是只更新当前项的显示，或者用户下次排序时自然会更新。
      // 为简单起见，我们暂时不在这里强制重新渲染整个列表，除非当前就是按使用次数排序。
      if (sortOrderSelect && (sortOrderSelect.value === 'usageCount_desc' || sortOrderSelect.value === 'usageCount_asc')) {
        renderPromptsList();
      } else {
        // 否则，只更新特定项的显示（如果该项当前可见）
        const itemElement = promptsList.querySelector(`.prompt-item [value="${promptId}"]`)?.closest('.prompt-item');
        if (itemElement) {
          const usageCountDiv = itemElement.querySelector('.prompt-usage-count');
          if (usageCountDiv) {
            usageCountDiv.textContent = `使用次数: ${prompts[promptIndex].usageCount}`;
          }
        }
      }
    });
  }
}

// 新增：移动提示词到指定文件夹的辅助函数
function movePromptToFolder(promptId, targetFolderId) {
  const promptIndex = prompts.findIndex(p => p.id === promptId);
  if (promptIndex !== -1) {
    // 检查是否真的移动到了不同的文件夹，或者从无文件夹移动到有文件夹，反之亦然
    if (prompts[promptIndex].folderId !== targetFolderId) {
      prompts[promptIndex].folderId = targetFolderId; // targetFolderId 可以是 null
      chrome.storage.local.set({ prompts }, () => {
        renderPromptsList();
        renderPromptFoldersList(); // 更新文件夹数量
        const targetFolderName = targetFolderId 
            ? (promptFolders.find(f => f.id === targetFolderId)?.name || '目标文件夹') 
            : '未分类';
        showNotification(`提示词已移至 "${targetFolderName}"`);
      });
    } else {
      // 如果拖动到当前所在的文件夹，则不执行任何操作或给一个温和的提示
      // console.log("Prompt is already in this folder.");
    }
  } else {
    console.error("Dropped prompt not found:", promptId);
  }
}

// 新增：批量移动选中的提示词到指定文件夹
function moveSelectedPromptsToFolder(targetFolderId, targetFolderName) {
  if (selectedPromptIds.size === 0) {
    showNotification('没有选中的提示词可移动。', 'warning');
    return;
  }

  let movedCount = 0;
  prompts.forEach(p => {
    if (selectedPromptIds.has(p.id)) {
      if (p.folderId !== targetFolderId) { // 只有当目标文件夹不同时才算移动
        p.folderId = targetFolderId;
        movedCount++;
      }
    }
  });

  if (movedCount > 0) {
    chrome.storage.local.set({ prompts }, () => {
      const initialSelectedSize = selectedPromptIds.size; // 保存初始数量用于通知
      selectedPromptIds.clear(); // 清空选择
      renderPromptsList();
      renderPromptFoldersList(); // 更新文件夹数量和按钮状态
      updateBatchActionUI(); // 更新批量操作区域的UI
      showNotification(`${initialSelectedSize} 个提示词已移至 "${targetFolderName}"`);
    });
  } else {
    showNotification('选中的提示词已在目标文件夹中，或没有实际移动。注意：无法将提示词移至"所有提示词"项。', 'info');
    // 即使没有实际移动，也最好清空一下选择，因为用户的意图是完成一个操作
    selectedPromptIds.clear();
    updateBatchActionUI();
    renderPromptFoldersList(); // 重新渲染文件夹列表以移除移动按钮
  }
}

// 新增：显示创建文件夹的内联输入界面
function showCreateFolderInput() {
  if (!createFolderBtn || !foldersList) return;
  const folderActionsArea = createFolderBtn.parentElement; // 通常是 .folder-actions

  createFolderBtn.style.display = 'none'; // 隐藏"创建文件夹"按钮

  const inputContainer = document.createElement('div');
  inputContainer.className = 'create-folder-inline-container';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '输入新文件夹名称...';
  input.className = 'create-folder-inline-input';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '保存';
  saveBtn.className = 'btn small primary create-folder-inline-save';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.className = 'btn small create-folder-inline-cancel';

  const tempActions = document.createElement('div');
  tempActions.className = 'create-folder-inline-actions';
  tempActions.appendChild(saveBtn);
  tempActions.appendChild(cancelBtn);

  inputContainer.appendChild(input);
  inputContainer.appendChild(tempActions);

  // 将输入容器添加到"创建文件夹"按钮原来的位置，或者 folderActionsArea 的末尾
  folderActionsArea.appendChild(inputContainer);
  input.focus();

  const cleanup = () => {
    folderActionsArea.removeChild(inputContainer);
    createFolderBtn.style.display = ''; // 重新显示"创建文件夹"按钮
    input.removeEventListener('keydown', handleKeydown);
  };

  const handleSave = () => {
    const folderName = input.value.trim();
    if (folderName) {
      createNewFolder(folderName);
    }
    cleanup();
  };

  const handleCancel = () => {
    cleanup();
  };

  const handleKeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  saveBtn.addEventListener('click', handleSave);
  cancelBtn.addEventListener('click', handleCancel);
  input.addEventListener('keydown', handleKeydown);
}

// 新增：根据宽度调整布局的函数
function adjustLayoutBasedOnWidth(width) {
  if (!promptsList) return;

  promptsList.classList.remove('two-columns', 'compact-grid'); // 移除现有布局类

  if (width > 700) { // 例如，宽度大于700px时使用紧凑网格
    promptsList.classList.add('compact-grid');
  } else if (width > 450) { // 宽度在450px到700px之间使用两列
    promptsList.classList.add('two-columns');
  } else {
    // 默认单列，不需要特定类，或者可以添加 'single-column' 类（如果CSS中有定义）
  }
  // 注意：这里没有显式调用 renderPromptsList，因为布局类本身会影响已渲染项的显示方式
  // 如果布局切换需要完全重新渲染项（例如，不同的HTML结构），则需要调用 renderPromptsList
}

// Add this new function to manage the visibility of the "Load More" button
function updateLoadMoreButtonVisibility() {
  const loadMoreContainer = document.getElementById('loadMoreContainer');
  if (loadMoreContainer) {
    if (noMorePrompts || isLoading) {
      loadMoreContainer.style.display = 'none';
    } else {
      loadMoreContainer.style.display = 'block'; // Or 'flex' or 'inline-block' depending on your layout
    }
  }
}