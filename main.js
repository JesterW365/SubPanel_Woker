
const DEFAULT_TEMPLATE = `port: 7890
socks-port: 7891
allow-lan: true
mode: Rule
log-level: info
external-controller: :9090
`;

const SUBSCRIBE_TEMPLATE_ITEM = `  "{name}":
    type: http
    url: {url}
    path: ./providers/{name}.yaml
    interval: 3600
    override:
      additional-prefix: "{name} "`;

const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SubPanel Worker</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M50 10L85 30V70L50 90L15 70V30L50 10Z' fill='%232563EB'/%3E%3Cpath d='M40 35L30 50L40 65' stroke='white' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M60 35L70 50L60 65' stroke='white' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='50' cy='50' r='3' fill='white'/%3E%3C/svg%3E">
    <script src="https://cdn.tailwindcss.com"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <style>
        [x-cloak] { display: none !important; }
    </style>
</head>
<body class="bg-gray-100 min-h-screen font-sans text-gray-800" x-data="appData()" x-init="initApp()">

    <!-- Admin Login Overlay -->
    <div x-show="!isAuthenticated" 
         class="fixed inset-0 z-[100] flex items-center justify-center bg-white/50 backdrop-blur-sm"
         x-transition:enter="transition ease-out duration-300"
         x-transition:enter-start="opacity-0"
         x-transition:enter-end="opacity-100"
         x-cloak>
        <div class="bg-white p-8 rounded-2xl shadow-2xl border border-blue-100 w-full max-w-md transform transition-all">
            <div class="text-center mb-6">
                <div class="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                    </svg>
                </div>
                <h2 class="text-2xl font-bold text-gray-800">管理员验证</h2>
                <p class="text-gray-500 mt-2">请输入管理员密码以访问面板</p>
            </div>
            
            <div class="space-y-4">
                <div>
                    <input type="password" 
                           x-model="loginInput" 
                           @keydown.enter="login()"
                           placeholder="管理员密码" 
                           class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                    <p x-show="loginError" x-text="loginError" class="text-red-500 text-sm mt-2" x-cloak></p>
                </div>
                <button @click="login()" 
                        :disabled="loginLoading"
                        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center">
                    <span x-show="loginLoading" class="animate-spin mr-2">⏳</span>
                    确定
                </button>
            </div>
        </div>
    </div>

    <!-- Header -->
    <header class="bg-white shadow-md p-4 sticky top-0 z-50">
        <div class="container mx-auto flex justify-between items-center">
            <div class="flex items-center space-x-3">
                <svg class="w-9 h-9" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M50 10L85 30V70L50 90L15 70V30L50 10Z" fill="#2563EB"/>
                    <path d="M40 35L30 50L40 65" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M60 35L70 50L60 65" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="50" cy="50" r="3" fill="white"/>
                </svg>
                <h1 class="text-2xl font-bold text-blue-600">SubPanel Worker</h1>
            </div>
            <a href="https://github.com/JesterW365/SubPanel_Woker" target="_blank" class="text-gray-600 hover:text-black transition">
                <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd" /></svg>
            </a>
        </div>
    </header>

    <main class="container mx-auto p-4 space-y-6 max-w-5xl">

        <!-- 1. Subscription Management -->
        <section class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-4 border-b pb-2">
                <h2 class="text-xl font-semibold text-gray-700">订阅管理</h2>
                <div class="text-sm font-medium" x-text="status.sub" :class="status.subClass"></div>
            </div>

            <!-- List -->
            <div class="space-y-3 mb-6">
                <template x-for="(sub, index) in subs" :key="index">
                    <div class="flex items-center justify-between bg-gray-50 p-3 rounded border">
                        <div class="flex-1">
                            <span class="font-bold text-gray-800" x-text="sub.name"></span>
                            <!-- URL hidden after add, unless editing (not implemented fully for security/simplicity, showing placeholder) -->
                        </div>
                        <div class="space-x-2">
                             <button @click="editSubMode(index)" class="text-blue-500 hover:text-blue-700 text-sm">编辑</button>
                             <button @click="deleteSub(index)" class="text-red-500 hover:text-red-700 text-sm">删除</button>
                        </div>
                    </div>
                </template>
                <div x-show="subs.length === 0" class="text-gray-400 text-center py-2">暂无订阅</div>
            </div>

            <!-- Add/Edit Form -->
            <div class="bg-gray-50 p-4 rounded border-dashed border-2 border-gray-200" x-show="subs.length < 5 || isEditingSub">
                <div class="grid grid-cols-1 md:grid-cols-[3fr_7fr] gap-4 mb-3">
                    <input type="text" x-model="subForm.name" placeholder="订阅名称" class="p-2 border rounded focus:ring-2 focus:ring-blue-300 outline-none">
                    <input type="text" x-model="subForm.url" placeholder="订阅链接 (Http/Https)" class="p-2 border rounded focus:ring-2 focus:ring-blue-300 outline-none">
                </div>
                <div class="flex justify-end space-x-3">
                    <button @click="resetSubForm()" x-show="isEditingSub || subForm.name || subForm.url" class="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded">取消</button>
                    <button @click="saveSub()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center">
                        <span x-show="subLoading" class="animate-spin mr-2">⏳</span>
                        <span x-text="isEditingSub ? '保存修改' : '添加订阅'"></span>
                    </button>
                </div>
            </div>
        </section>

        <!-- 2. Node Management -->
        <section class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-4 border-b pb-2">
                <h2 class="text-xl font-semibold text-gray-700">节点管理</h2>
                <div class="text-sm font-medium" x-text="status.node" :class="status.nodeClass"></div>
            </div>

            <!-- List -->
             <div class="space-y-3 mb-6">
                <template x-for="(node, index) in nodes" :key="index">
                    <div class="bg-gray-50 p-3 rounded border">
                         <div class="flex items-center justify-between mb-2">
                            <span class="font-bold text-gray-800" x-text="node.name"></span>
                            <div class="space-x-2">
                                <button @click="editNodeMode(index)" class="text-blue-500 hover:text-blue-700 text-sm">编辑</button>
                                <button @click="deleteNode(index)" class="text-red-500 hover:text-red-700 text-sm">删除</button>
                            </div>
                        </div>
                        <div x-show="expandedNode === index" class="mt-2 text-xs font-mono bg-gray-800 text-green-400 p-2 rounded overflow-x-auto">
                            <pre x-text="node.content"></pre>
                        </div>
                        <button @click="expandedNode = (expandedNode === index ? -1 : index)" class="text-xs text-gray-500 underline">
                            <span x-text="expandedNode === index ? '收起内容' : '查看内容'"></span>
                        </button>
                    </div>
                </template>
                 <div x-show="nodes.length === 0" class="text-gray-400 text-center py-2">暂无节点</div>
            </div>

            <!-- Add/Edit Form -->
             <div class="bg-gray-50 p-4 rounded border-dashed border-2 border-gray-200" x-show="nodes.length < 5 || isEditingNode">
                <div class="mb-3">
                    <input type="text" x-model="nodeForm.name" placeholder="节点名称" class="w-full p-2 border rounded focus:ring-2 focus:ring-green-300 outline-none mb-2">
                    <textarea x-model="nodeForm.content" rows="4" placeholder="节点内容 (JSON 或 YAML)" class="w-full p-2 border rounded focus:ring-2 focus:ring-green-300 outline-none font-mono text-sm"></textarea>
                </div>
                <div class="flex justify-end space-x-3">
                    <button @click="resetNodeForm()" x-show="isEditingNode || nodeForm.name || nodeForm.content" class="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded">取消</button>
                    <button @click="saveNode()" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                         <span x-text="isEditingNode ? '保存修改' : '添加节点'"></span>
                    </button>
                </div>
            </div>
        </section>

        <!-- 3. Template Management -->
        <section class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-4 border-b pb-2">
                <h2 class="text-xl font-semibold text-gray-700">模板管理</h2>
                <div class="text-sm font-medium" x-text="status.template" :class="status.templateClass"></div>
            </div>
             <!-- List -->
            <div class="space-y-3 mb-6">
                <!-- Default Template -->
                 <div class="bg-gray-100 p-3 rounded border border-gray-300">
                    <div class="flex items-center justify-between">
                         <div class="flex flex-col">
                            <span class="font-bold text-gray-600" x-text="'默认模板' + (hasDefaultTemplate ? '(已加载)' : '(等待加载)')"></span>
                            <span class="text-[10px] text-gray-400" x-show="meta0" x-text="'最后更新(服务器时间): ' + (meta0 ? meta0.updatedAt : '')"></span>
                         </div>
                         <div class="flex space-x-2 items-center">
                            <button @click="updateDefaultTemplate()" class="text-blue-500 hover:text-blue-700 text-sm">更新</button>
                            <span class="text-xs bg-gray-200 px-2 py-1 rounded">只读</span>
                         </div>
                    </div>
                </div>

                <template x-for="(tpl, index) in templates" :key="index">
                    <div class="bg-gray-50 p-3 rounded border">
                         <div class="flex items-center justify-between">
                            <div class="flex flex-col">
                                <span class="font-bold text-gray-800" x-text="tpl.name"></span>
                                <span class="text-[10px] text-gray-400" x-show="tpl.type === 'url'" x-text="'最后更新(服务器时间): ' + tpl.updatedAt"></span>
                            </div>
                            <div class="space-x-2">
                                <button x-show="tpl.type === 'url'" @click="refreshTemplate(index)" class="text-green-500 hover:text-green-700 text-sm">更新</button>
                                <button @click="editTemplateMode(index)" class="text-blue-500 hover:text-blue-700 text-sm">编辑</button>
                                <button @click="deleteTemplate(index)" class="text-red-500 hover:text-red-700 text-sm">删除</button>
                            </div>
                        </div>
                    </div>
                </template>
            </div>

            <!-- Add/Edit Form -->
             <div class="bg-gray-50 p-4 rounded border-dashed border-2 border-gray-200" x-show="templates.length < 5 || isEditingTemplate">
                <div class="mb-3">
                    <input type="text" x-model="tplForm.name" placeholder="模板名称" class="w-full p-2 border rounded focus:ring-2 focus:ring-purple-300 outline-none mb-2">
                    <textarea x-model="tplForm.content" rows="6" :placeholder="isEditingTemplate && templates[editingTemplateIndex].type === 'url' ? '模板链接' : '模板内容或链接'" class="w-full p-2 border rounded focus:ring-2 focus:ring-purple-300 outline-none font-mono text-sm"></textarea>
                </div>
                <div class="flex justify-between items-center">
                    <div class="text-xs text-info px-2 py-1 rounded bg-blue-50 text-blue-600 border border-blue-100" x-show="templateActionMsg" x-text="templateActionMsg" x-cloak></div>
                    <div class="flex-1"></div>
                    <div class="flex space-x-3">
                        <button @click="resetTemplateForm()" x-show="isEditingTemplate || tplForm.name || tplForm.content" class="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded">取消</button>
                        <button @click="saveTemplate()" class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center">
                            <span x-show="templateLoading" class="animate-spin mr-2">⏳</span>
                            <span x-text="isEditingTemplate ? '保存修改' : '添加模板'"></span>
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <!-- 4. Merge Operation -->
        <section class="bg-white rounded-lg shadow p-6 border-t-4 border-indigo-500">
            <div class="flex justify-between items-center mb-4 border-b pb-2">
                <h2 class="text-xl font-semibold text-gray-700">合并操作</h2>
                <div class="text-sm font-medium" x-text="status.merge" :class="status.mergeClass"></div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <!-- Subs Selection -->
                <div>
                    <h3 class="font-bold mb-2 text-gray-600">选择订阅</h3>
                    <div class="space-y-2 max-h-40 overflow-y-auto">
                        <template x-for="sub in subs" :key="sub.name">
                            <label class="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" :value="sub.name" x-model="selectedSubs" class="form-checkbox text-indigo-600 h-5 w-5">
                                <span x-text="sub.name"></span>
                            </label>
                        </template>
                         <div x-show="subs.length === 0" class="text-sm text-gray-400">无可用订阅</div>
                    </div>
                </div>

                <!-- Nodes Selection -->
                <div>
                    <h3 class="font-bold mb-2 text-gray-600">选择节点</h3>
                    <div class="space-y-2 max-h-40 overflow-y-auto">
                        <template x-for="node in nodes" :key="node.name">
                            <label class="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" :value="node.name" x-model="selectedNodes" class="form-checkbox text-green-600 h-5 w-5">
                                <span x-text="node.name"></span>
                            </label>
                        </template>
                        <div x-show="nodes.length === 0" class="text-sm text-gray-400">无可用节点</div>
                    </div>
                </div>

                 <!-- Template Selection -->
                <div>
                    <h3 class="font-bold mb-2 text-gray-600">选择模板 (单选)</h3>
                    <div class="space-y-2 max-h-40 overflow-y-auto">
                        <label class="flex items-center space-x-2 cursor-pointer">
                            <input type="radio" value="template0" x-model="selectedTemplate" class="form-radio text-purple-600 h-5 w-5">
                            <span>默认模板(已加载)</span>
                        </label>
                        <template x-for="tpl in templates" :key="tpl.name">
                            <label class="flex items-center space-x-2 cursor-pointer">
                                <input type="radio" :value="tpl.name" x-model="selectedTemplate" class="form-radio text-purple-600 h-5 w-5">
                                <span x-text="tpl.name"></span>
                            </label>
                        </template>
                    </div>
                </div>
            </div>

            <div class="flex justify-between items-center">
                 <button @click="resetSelections()" class="text-gray-500 hover:text-gray-700 underline text-sm">重置勾选</button>
                 <button @click="doMerge()" :disabled="!canMerge" class="px-6 py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg">
                    🚀 合并生成配置
                 </button>
            </div>

             <!-- Result Area -->
            <div x-show="mergeResultUrl" class="mt-6 p-4 bg-gray-800 rounded text-white" x-cloak>
                <div class="flex justify-between items-center mb-2">
                    <p class="text-gray-300 text-sm">配置已生成！订阅链接：</p>
                    <button @click="resetToken()" class="text-xs text-red-400 hover:text-red-300 underline">重置加密后缀</button>
                </div>
                <div class="flex items-center bg-gray-900 p-2 rounded border border-gray-700">
                    <input type="text" readonly :value="mergeResultUrl" class="bg-transparent w-full outline-none text-green-400 font-mono text-sm leading-relaxed">
                    <button @click="copyUrl()" class="ml-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">copy</button>
                </div>
                <p class="mt-2 text-[10px] text-gray-500">提示：重置后缀后，旧的订阅链接将失效，需重新导入客户端。</p>
            </div>
        </section>

    </main>

    <script>
        function appData() {
            return {
                subs: [],
                nodes: [],
                templates: [],
                
                // Admin Auth
                isAuthenticated: false,
                loginInput: '',
                loginError: '',
                loginLoading: false,
                adminSavedPassword: '',
                // Forms
                subForm: { name: '', url: '' },
                nodeForm: { name: '', content: '' },
                tplForm: { name: '', content: '' },

                // UI States
                isEditingSub: false,
                editingSubIndex: -1,
                isEditingNode: false,
                editingNodeIndex: -1,
                isEditingTemplate: false,
                editingTemplateIndex: -1,
                expandedNode: -1,
                subLoading: false,

                // Selections
                selectedSubs: [],
                selectedNodes: [],
                selectedTemplate: 'template0',
                
                // Merge Result
                mergeResultUrl: '',

                // Status Messages
                status: {
                    sub: '', subClass: '',
                    node: '', nodeClass: '',
                    template: '', templateClass: '',
                    merge: '', mergeClass: ''
                },
                
                // Template Extensions
                hasDefaultTemplate: false,
                meta0: null,
                templateLoading: false,
                templateActionMsg: '',

                // Token Security
                configToken: '',

                async initApp() {
                    // Check if already authenticated (though we don't persist it, we need to show the UI)
                    // No action needed for initApp as we want the overlay to show by default.
                },

                async login() {
                    if (!this.loginInput) return;
                    this.loginLoading = true;
                    this.loginError = '';
                    
                    try {
                        const res = await fetch('/api/auth/verify', {
                            method: 'POST',
                            body: JSON.stringify({ password: this.loginInput })
                        });
                        const data = await res.json();
                        
                        if (res.ok) {
                            this.adminSavedPassword = this.loginInput;
                            this.isAuthenticated = true;
                            await this.fetchDataAfterAuth();
                        } else {
                            this.loginError = data.error || '密码错误';
                        }
                    } catch (e) {
                        this.loginError = '网络请求失败';
                    } finally {
                        this.loginLoading = false;
                    }
                },

                async fetchDataAfterAuth() {
                    await this.fetchData();
                    // Load selections from local storage
                    const saved = JSON.parse(localStorage.getItem('subpanel_selections') || '{}');
                    if (saved.subs) this.selectedSubs = saved.subs;
                    if (saved.nodes) this.selectedNodes = saved.nodes;
                    if (saved.template) this.selectedTemplate = saved.template;
                    
                    // Fetch security token
                    const tokenData = await fetch('/api/token/get', {
                        headers: { 'x-admin-password': this.adminSavedPassword }
                    }).then(r => r.json());
                    this.configToken = tokenData.token;
                },

                async fetchData() {
                    const headers = { 'x-admin-password': this.adminSavedPassword };
                    this.subs = await fetch('/api/sub/list', { headers }).then(r => r.json());
                    this.nodes = await fetch('/api/node/list', { headers }).then(r => r.json());
                    const tplRes = await fetch('/api/template/list', { headers }).then(r => r.json());
                    this.templates = tplRes.templates;
                    this.hasDefaultTemplate = tplRes.has0;
                    this.meta0 = tplRes.meta0;
                },

                // --- Helpers ---
                setStatus(type, msg, isError = false) {
                    this.status[type] = msg + (isError ? ' 🔴' : ' 🟢');
                    this.status[type + 'Class'] = isError ? 'text-red-500' : 'text-green-600';
                    setTimeout(() => { this.status[type] = ''; }, 3000);
                },

                // --- Subscription ---
                resetSubForm() {
                    this.subForm = { name: '', url: '' };
                    this.isEditingSub = false;
                    this.editingSubIndex = -1;
                    this.subLoading = false;
                },
                async saveSub() {
                    if (!this.subForm.name.trim() || !this.subForm.url.trim()) return alert('名称和链接不能为空');
                    
                    let finalUrl = this.subForm.url;
                    if (this.isEditingSub && finalUrl === '***') {
                        // 用户没有修改链接，使用原始链接提交
                        finalUrl = this.subs[this.editingSubIndex].url;
                    }

                    this.subLoading = true;
                    const endpoint = this.isEditingSub ? '/api/sub/update' : '/api/sub/add';
                    const payload = { ...this.subForm, url: finalUrl, index: this.editingSubIndex };

                    try {
                        const res = await fetch(endpoint, { 
                            method: 'POST', 
                            headers: { 'x-admin-password': this.adminSavedPassword },
                            body: JSON.stringify(payload) 
                        });
                        const data = await res.json();
                        
                        if (!res.ok) {
                             if (data.confirmationNeeded) {
                                 if (confirm(data.error + '\\n是否强制保存？')) {
                                     // Retry with force
                                     const res2 = await fetch(endpoint, { 
                                         method: 'POST', 
                                         headers: { 'x-admin-password': this.adminSavedPassword },
                                         body: JSON.stringify({...payload, force: true}) 
                                     });
                                     const data2 = await res2.json();
                                     if (!res2.ok) throw new Error(data2.error);
                                     this.handleSubSuccess(data2);
                                 }
                             } else {
                                 throw new Error(data.error);
                             }
                        } else {
                            this.handleSubSuccess(data);
                        }
                    } catch (e) {
                        this.setStatus('sub', e.message, true);
                    } finally {
                        this.subLoading = false;
                    }
                },
                handleSubSuccess(data) {
                    this.subs = data.subs;
                    this.setStatus('sub', this.isEditingSub ? '更新成功' : '添加成功');
                    this.resetSubForm();
                },
                editSubMode(index) {
                    const sub = this.subs[index];
                    this.subForm = { name: sub.name, url: '***' }; 
                    this.isEditingSub = true;
                    this.editingSubIndex = index;
                },
                async deleteSub(index) {
                    if (!confirm('确定删除此订阅？')) return;
                    const res = await fetch('/api/sub/delete', { 
                        method: 'POST', 
                        headers: { 'x-admin-password': this.adminSavedPassword },
                        body: JSON.stringify({ index }) 
                    });
                    const data = await res.json();
                    this.subs = data.subs;
                    this.setStatus('sub', '删除成功');
                },

                // --- Node ---
                resetNodeForm() {
                    this.nodeForm = { name: '', content: '' };
                    this.isEditingNode = false;
                    this.editingNodeIndex = -1;
                },
                async saveNode() {
                     if (!this.nodeForm.name.trim() || !this.nodeForm.content.trim()) return alert('名称和内容不能为空');
                     const endpoint = this.isEditingNode ? '/api/node/update' : '/api/node/add';
                     const payload = { ...this.nodeForm, index: this.editingNodeIndex };
                     
                      try {
                        const res = await fetch(endpoint, { 
                            method: 'POST', 
                            headers: { 'x-admin-password': this.adminSavedPassword },
                            body: JSON.stringify(payload) 
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        this.nodes = data.nodes;
                        this.setStatus('node', this.isEditingNode ? '更新成功' : '添加成功');
                        this.resetNodeForm();
                     } catch (e) {
                         this.setStatus('node', e.message, true);
                     }
                },
                editNodeMode(index) {
                    this.nodeForm = { ...this.nodes[index] };
                    this.isEditingNode = true;
                    this.editingNodeIndex = index;
                },
                async deleteNode(index) {
                    if (!confirm('确定删除此节点？')) return;
                    const res = await fetch('/api/node/delete', { 
                        method: 'POST', 
                        headers: { 'x-admin-password': this.adminSavedPassword },
                        body: JSON.stringify({ index }) 
                    });
                    const data = await res.json();
                    this.nodes = data.nodes;
                    this.setStatus('node', '删除成功');
                },

                // --- Template ---
                resetTemplateForm() {
                    this.tplForm = { name: '', content: '' };
                    this.isEditingTemplate = false;
                    this.editingTemplateIndex = -1;
                    this.templateLoading = false;
                },
                async saveTemplate() {
                    if (!this.tplForm.name.trim() || !this.tplForm.content.trim()) return alert('名称和内容/链接不能为空');
                    
                    this.templateLoading = true;
                    this.templateActionMsg = '正在提交并校验...';
                    
                    const endpoint = this.isEditingTemplate ? '/api/template/update' : '/api/template/add';
                    const payload = { ...this.tplForm, index: this.editingTemplateIndex };

                    try {
                        const res = await fetch(endpoint, { 
                            method: 'POST', 
                            headers: { 'x-admin-password': this.adminSavedPassword },
                            body: JSON.stringify(payload) 
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        
                        this.templates = data.templates;
                        this.setStatus('template', this.isEditingTemplate ? '更新成功' : '添加成功');
                        this.templateActionMsg = '保存成功';
                        setTimeout(() => this.templateActionMsg = '', 3000);
                        this.resetTemplateForm();
                    } catch (e) {
                         this.setStatus('template', e.message, true);
                         this.templateActionMsg = '失败: ' + e.message;
                    } finally {
                        this.templateLoading = false;
                    }
                },
                editTemplateMode(index) {
                    const tpl = this.templates[index];
                    this.tplForm = { 
                        name: tpl.name, 
                        content: tpl.type === 'url' ? tpl.url : tpl.content 
                    };
                    this.isEditingTemplate = true;
                    this.editingTemplateIndex = index;
                },
                async deleteTemplate(index) {
                    if (!confirm('确定删除此模板？')) return;
                    const res = await fetch('/api/template/delete', { 
                        method: 'POST', 
                        headers: { 'x-admin-password': this.adminSavedPassword },
                        body: JSON.stringify({ index }) 
                    });
                    const data = await res.json();
                    this.templates = data.templates;
                    this.setStatus('template', '删除成功');
                },
                async refreshTemplate(index) {
                    this.setStatus('template', '正在从链接更新...');
                    try {
                        const res = await fetch('/api/template/refresh', { 
                            method: 'POST', 
                            headers: { 'x-admin-password': this.adminSavedPassword },
                            body: JSON.stringify({ index }) 
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        this.templates = data.templates;
                        this.setStatus('template', '链接内容更新成功');
                    } catch (e) {
                        this.setStatus('template', e.message, true);
                    }
                },
                async updateDefaultTemplate() {
                    this.setStatus('template', '正在获取默认模板...');
                    try {
                        const res = await fetch('/api/template/update_default', { 
                            method: 'POST',
                            headers: { 'x-admin-password': this.adminSavedPassword }
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        this.hasDefaultTemplate = true;
                        this.meta0 = data.meta;
                        this.setStatus('template', '默认模板已同步');
                    } catch (e) {
                        this.setStatus('template', e.message, true);
                    }
                },

                // --- Merge ---
                get canMerge() {
                    return (this.selectedSubs.length > 0 || this.selectedNodes.length > 0) && this.selectedTemplate;
                },
                resetSelections() {
                    this.selectedSubs = [];
                    this.selectedNodes = [];
                    this.selectedTemplate = 'template0';
                    this.mergeResultUrl = '';
                },
                async doMerge() {
                    // Save state
                    localStorage.setItem('subpanel_selections', JSON.stringify({
                        subs: this.selectedSubs,
                        nodes: this.selectedNodes,
                        template: this.selectedTemplate
                    }));

                    try {
                        const res = await fetch('/api/merge', {
                            method: 'POST',
                            headers: { 'x-admin-password': this.adminSavedPassword },
                            body: JSON.stringify({
                                sub_names: this.selectedSubs,
                                node_names: this.selectedNodes,
                                template_name: this.selectedTemplate
                            })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        
                        this.setStatus('merge', '合并成功');
                        this.mergeResultUrl = window.location.origin + '/config=' + this.configToken;
                    } catch (e) {
                        this.setStatus('merge', e.message, true);
                    }
                },
                async resetToken() {
                    if (!confirm('确定要重置加密后缀吗？\\n这将导致所有已分发的订阅链接失效，您需要重新在客户端导入新链接。')) return;
                    try {
                        const res = await fetch('/api/token/reset', { 
                            method: 'POST',
                            headers: { 'x-admin-password': this.adminSavedPassword }
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        this.configToken = data.token;
                        if (this.mergeResultUrl) {
                            this.mergeResultUrl = window.location.origin + '/config=' + this.configToken;
                        }
                        alert('已生成新的加密后缀，请及时更新您的订阅。');
                    } catch (e) {
                         alert('重置失败: ' + e.message);
                    }
                },
                copyUrl() {
                    navigator.clipboard.writeText(this.mergeResultUrl);
                    alert('已复制到剪贴板');
                }
            }
        }
    </script>
</body>
</html>
`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // --- Auth Middleware ---
    let adminPass = await env.SUBPANEL_KV.get('ADMIN_PASSWORD');
    if (!adminPass) {
        adminPass = 'admin';
        await env.SUBPANEL_KV.put('ADMIN_PASSWORD', adminPass);
    }

    const verifyAuth = (req) => {
        const password = req.headers.get('x-admin-password');
        return password === adminPass;
    };

    // Auth API (special because it doesn't use the header yet)
    if (path === '/api/auth/verify' && method === 'POST') {
        const { password } = await request.json();
        if (password === adminPass) {
            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: '密码错误' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // Protect all other APIs
    if (path.startsWith('/api/')) {
        if (!verifyAuth(request)) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid Admin Password' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
    }

    // --- Helpers ---
    const getJSON = async (key) => {
        const val = await env.SUBPANEL_KV.get(key);
        return val ? JSON.parse(val) : [];
    };
    const putJSON = async (key, val) => await env.SUBPANEL_KV.put(key, JSON.stringify(val));
    
    // 模板验证器 (proxy-groups: 和 rules:)
    const validateTemplate = (text) => {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        let hasGroups = false;
        let hasRules = false;
        for (let line of lines) {
            if (line.startsWith('proxy-groups:')) hasGroups = true;
            if (line.startsWith('rules:')) hasRules = true;
        }
        return hasGroups && hasRules;
    };

    const fetchAndValidateTemplate = async (url) => {
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'ClashMeta' } });
            if (!res.ok) return { error: `HTTP ${res.status}` };
            const text = await res.text();
            if (!validateTemplate(text)) return { error: '内容不满足模板格式(需要 proxy-groups 和 rules)' };
            return { content: text };
        } catch (e) {
            return { error: e.message };
        }
    };

    const generateRandomToken = (length = 16) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };
    
    // 节点格式转换器（YAML 转松散 JSON）
    const convertNode = (content) => {
        content = content.trim();
        
        // 如果已经是 JSON 格式，验证并返回
        if (content.startsWith('{') && content.endsWith('}')) {
            try {
                JSON.parse(content); // 仅验证
                return content; // 保持原样，不重新格式化
            } catch (e) {
                // 尝试作为 YAML 处理
            }
        }

        // YAML 转换逻辑
        const lines = content.split('\n');
        const obj = {};
        const stack = [{ obj, indent: -1 }]; // 栈用于追踪嵌套层级
        
        for (let line of lines) {
            // 跳过空行和注释
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            // 检测缩进
            const indent = line.match(/^(\s*)/)[1].length;
            
            // 分割键值对
            const colonIndex = trimmed.indexOf(':');
            if (colonIndex === -1) continue;
            
            const key = trimmed.substring(0, colonIndex).trim();
            const value = trimmed.substring(colonIndex + 1).trim();
            
            // 根据缩进调整栈（退出比当前缩进深的层级）
            while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
                stack.pop();
            }
            
            const currentObj = stack[stack.length - 1].obj;
            
            // 如果值为空，这是一个嵌套对象
            if (!value) {
                currentObj[key] = {};
                stack.push({ obj: currentObj[key], indent });
            } else {
                // 普通键值对
                currentObj[key] = parseYamlValue(value);
            }
        }
        
        return toLooseJSON(obj);
    };
    
    // YAML 值解析辅助函数
    const parseYamlValue = (value) => {
        if (!value) return '';
        
        // 去除引号
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
            return value.slice(1, -1);
        }
        
        // 布尔值
        if (value === 'true') return true;
        if (value === 'false') return false;
        
        // 数字
        if (!isNaN(Number(value)) && value !== '') {
            return Number(value);
        }
        
        return value;
    };
    
    // 转换为松散 JSON 格式（键不加引号）
    const toLooseJSON = (obj) => {
        if (typeof obj !== 'object' || obj === null) {
            // 字符串值需要加引号
            if (typeof obj === 'string') {
                return `"${obj.replace(/"/g, '\\"')}"`;
            }
            return String(obj);
        }
        
        if (Array.isArray(obj)) {
            return '[' + obj.map(toLooseJSON).join(', ') + ']';
        }
        
        const pairs = Object.entries(obj).map(([key, value]) => {
            return `${key}: ${toLooseJSON(value)}`;
        });
        
        return '{' + pairs.join(', ') + '}';
    };


    // --- Router ---
    
    // Frontend
    if (path === '/' && method === 'GET') {
        return new Response(HTML_CONTENT, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    }

    // Config Download
    if (path.startsWith('/config')) {
        const storedToken = await env.SUBPANEL_KV.get('CONFIG_TOKEN');
        const expectedPath = '/config=' + storedToken;
        
        if (path !== expectedPath) {
            return new Response('Unauthorized: Invalid Config Token', { status: 403 });
        }

        const config = await env.SUBPANEL_KV.get('myconfig');
        return new Response(config || '# No config generated yet', { headers: { 'Content-Type': 'text/yaml;charset=UTF-8' } });
    }

    // --- APIs ---
    const headers = { 'Content-Type': 'application/json' };
    const err = (msg, extra = {}) => new Response(JSON.stringify({ error: msg, ...extra }), { status: 400, headers });
    const ok = (data) => new Response(JSON.stringify(data), { headers });

    // SECURITY TOKEN
    if (path.startsWith('/api/token/')) {
        let token = await env.SUBPANEL_KV.get('CONFIG_TOKEN');
        if (!token) {
            token = generateRandomToken();
            await env.SUBPANEL_KV.put('CONFIG_TOKEN', token);
        }

        if (path === '/api/token/get') return ok({ token });
        if (path === '/api/token/reset' && method === 'POST') {
            token = generateRandomToken();
            await env.SUBPANEL_KV.put('CONFIG_TOKEN', token);
            return ok({ token });
        }
    }

    // SUBSCRIPTION
    if (path.startsWith('/api/sub/')) {
        let subs = await getJSON('SUBS');
        
        if (path === '/api/sub/list') return ok(subs);

        const body = await request.json();
        
        if (path === '/api/sub/delete') {
            subs.splice(body.index, 1);
            await putJSON('SUBS', subs);
            return ok({ subs });
        }

        // Common validation for Add/Update
        if (!body.name || !body.url) return err('Name and URL required');
        
        // Check Name Duplication (exclude self if updating)
        const nameExists = subs.some((s, i) => s.name === body.name && i !== body.index);
        if (nameExists) return err('订阅名称已存在');

        // Check URL Connectivity
        // If it's an update and URL didn't change, skip check? The prompt says "If new URL, check".
        let skipCheck = false;
        if (path === '/api/sub/update' && subs[body.index].url === body.url) skipCheck = true;

        if (!skipCheck && !body.force) {
             try {
                 const check = await fetch(body.url, { method: 'HEAD', headers: {'User-Agent': 'ClashMeta'} });
                 if (!check.ok) throw new Error('Status ' + check.status);
             } catch (e) {
                 return err('订阅链接无法连通: ' + e.message, { confirmationNeeded: true });
             }
        }

        if (path === '/api/sub/add') {
            if (subs.length >= 5) return err('最多添加5个订阅');
            subs.push({ name: body.name, url: body.url });
        } else if (path === '/api/sub/update') {
            subs[body.index] = { name: body.name, url: body.url };
        }

        await putJSON('SUBS', subs);
        return ok({ subs });
    }

    // NODES
    if (path.startsWith('/api/node/')) {
        let nodes = await getJSON('NODES');
        if (path === '/api/node/list') return ok(nodes);

        const body = await request.json();

        if (path === '/api/node/delete') {
            nodes.splice(body.index, 1);
            await putJSON('NODES', nodes);
            return ok({ nodes });
        }

        if (!body.name || !body.content) return err('Name and Content required');
        
        // Convert Content
        let safeContent;
        try {
            safeContent = convertNode(body.content);
        } catch (e) {
            return err('节点内容格式无法解析');
        }

        if (path === '/api/node/add') {
             if (nodes.length >= 5) return err('最多添加5个节点');
             nodes.push({ name: body.name, content: safeContent });
        } else if (path === '/api/node/update') {
            nodes[body.index] = { name: body.name, content: safeContent };
        }

        await putJSON('NODES', nodes);
        return ok({ nodes });
    }

    // TEMPLATES
    if (path.startsWith('/api/template/')) {
        let templates = await getJSON('TEMPLATES');
        if (path === '/api/template/list') {
            const meta0 = await env.SUBPANEL_KV.get('template0_meta');
            const has0 = !!(await env.SUBPANEL_KV.get('template0'));
            return ok({ templates, has0, meta0: meta0 ? JSON.parse(meta0) : null });
        }

        const DEFAULT_TPL_URL = 'https://raw.githubusercontent.com/JesterW365/Clash_Rulesets_Template/master/Custom_templates/default_template.yaml';

        // 默认模板更新操作 (无正文请求)
        if (path === '/api/template/update_default') {
            const res = await fetchAndValidateTemplate(DEFAULT_TPL_URL);
            if (res.error) return err(`默认模板更新失败: ${res.error}`);
            await env.SUBPANEL_KV.put('template0', res.content);
            const meta = { updatedAt: new Date().toLocaleString('zh-CN') };
            await env.SUBPANEL_KV.put('template0_meta', JSON.stringify(meta));
            return ok({ success: true, meta });
        }

        const body = await request.json();

        if (path === '/api/template/delete') {
            templates.splice(body.index, 1);
            await putJSON('TEMPLATES', templates);
            return ok({ templates });
        }

        // 链接型模板的手动更新
        if (path === '/api/template/refresh') {
            const t = templates[body.index];
            if (!t || t.type !== 'url') return err('无效的模板更新请求');
            const res = await fetchAndValidateTemplate(t.url);
            if (res.error) return err(`更新失败: ${res.error} (保留原内容)`);
            t.content = res.content;
            t.updatedAt = new Date().toLocaleString('zh-CN');
            await putJSON('TEMPLATES', templates);
            return ok({ templates });
        }

        if (!body.name || !body.content) return err('名称和内容/链接不能为空');

        let type = 'txt';
        let content = body.content.trim();
        let url = '';
        let updatedAt = '';

        if (content.startsWith('http://') || content.startsWith('https://')) {
            type = 'url';
            url = content;
            const res = await fetchAndValidateTemplate(url);
            if (res.error) return err(`链接内容无效: ${res.error}`);
            content = res.content;
            updatedAt = new Date().toLocaleString('zh-CN');
        } else {
            if (!validateTemplate(content)) return err('文本内容不满足模板格式(至少需要 策略组 和 规则)');
        }

        if (path === '/api/template/add') {
            if (templates.length >= 5) return err('最多添加5个模板');
            templates.push({ name: body.name, type, url, content, updatedAt });
        } else if (path === '/api/template/update') {
            const old = templates[body.index];
            templates[body.index] = { name: body.name, type, url, content, updatedAt: updatedAt || old.updatedAt };
        }

        await putJSON('TEMPLATES', templates);
        return ok({ templates });
    }

    // MERGE
    if (path === '/api/merge' && method === 'POST') {
        const { sub_names, node_names, template_name } = await request.json();

        if ((!sub_names?.length && !node_names?.length) || !template_name) {
            return err('至少选择一个订阅或节点，且必须选择一个模板');
        }

        // Fetch Data
        const subs = await getJSON('SUBS');
        const nodes = await getJSON('NODES');
        const templates = await getJSON('TEMPLATES');
        
        // 1. Get Template Content
        let baseTemplate = '';
        if (template_name === 'template0') {
            baseTemplate = (await env.SUBPANEL_KV.get('template0')) || DEFAULT_TEMPLATE;
        } else {
            const t = templates.find(t => t.name === template_name);
            if (!t) return err('Template not found');
            baseTemplate = t.content;
        }

        // 2. Process Subs (Proxy Providers)
        let proxyProvidersBlock = '';
        if (sub_names && sub_names.length > 0) {
             const selectedSubs = subs.filter(s => sub_names.includes(s.name));
             if (selectedSubs.length > 0) {
                 proxyProvidersBlock = 'proxy-providers:\n';
                 selectedSubs.forEach(sub => {
                     let item = SUBSCRIBE_TEMPLATE_ITEM
                        .replace(/{name}/g, sub.name)
                        .replace(/{url}/g, sub.url);
                     proxyProvidersBlock += item + '\n';
                 });
             }
        }

        // 3. Process Nodes (Proxies)
        let proxiesBlock = '';
        if (node_names && node_names.length > 0) {
            const selectedNodes = nodes.filter(n => node_names.includes(n.name));
            if (selectedNodes.length > 0) {
                proxiesBlock = 'proxies:\n';
                selectedNodes.forEach(node => {
                    proxiesBlock += `  - ${node.content}\n`;
                });
            }
        }

        // 4. Combine (Prepend to template)
        // Ensure newlines
        const finalConfig = `${proxiesBlock}\n${proxyProvidersBlock}\n${baseTemplate}`;
        
        await env.SUBPANEL_KV.put('myconfig', finalConfig);
        return ok({ success: true });
    }

    return new Response('Not Found', { status: 404 });
  }
};
