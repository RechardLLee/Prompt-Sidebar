document.addEventListener('DOMContentLoaded', () => {
  const backToSidepanelBtn = document.getElementById('backToSidepanelBtn');

  if (backToSidepanelBtn) {
    backToSidepanelBtn.addEventListener('click', () => {
      // 假设您的侧边栏主页面是 sidepanel.html
      chrome.sidePanel.setOptions({ path: 'sidepanel.html' });
    });
  }

  loadAnalyticsData();
});

function loadAnalyticsData() {
  chrome.storage.local.get('prompts', (data) => {
    const prompts = data.prompts || [];
    if (prompts.length === 0) {
      renderEmptyState();
      return;
    }
    renderUsageFrequencyChart(prompts);
    renderUsageTimeDistributionChart(prompts);
  });
}

function renderEmptyState() {
  const mainElement = document.querySelector('.analytics-main');
  if (mainElement) {
    mainElement.innerHTML = '<p class="no-prompts" style="text-align: center; padding: 40px 0;">没有可供分析的提示词数据。</p>';
  }
}

function renderUsageFrequencyChart(prompts) {
  const ctx = document.getElementById('usageFrequencyChart')?.getContext('2d');
  if (!ctx) return;

  const sortedPrompts = [...prompts].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  const topPrompts = sortedPrompts.slice(0, 10);

  const labels = topPrompts.map(p => p.title || '无标题');
  const dataValues = topPrompts.map(p => p.usageCount || 0);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '使用次数',
        data: dataValues,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1 // 确保Y轴刻度为整数
          }
        }
      }
    }
  });
}

function renderUsageTimeDistributionChart(prompts) {
  const ctx = document.getElementById('usageTimeDistributionChart')?.getContext('2d');
  if (!ctx) return;

  const usageByHour = Array(24).fill(0);
  prompts.forEach(prompt => {
    if (prompt.lastUsedAt) {
      try {
        const hour = new Date(prompt.lastUsedAt).getHours();
        usageByHour[hour]++;
      } catch (e) {
        console.warn(`无法解析日期: ${prompt.lastUsedAt}`, e);
      }
    }
  });

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`), // 00:00 to 23:00
      datasets: [{
        label: '提示词使用次数 (按小时)',
        data: usageByHour,
        fill: false,
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
} 