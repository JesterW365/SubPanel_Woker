
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
    interval: {interval}
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
                    <div class="bg-gray-50 p-3 rounded border">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex-1">
                                <span class="font-bold text-gray-800" x-text="sub.name"></span>
                            </div>
                            <div class="space-x-2">
                                <button @click="editSubMode(index)" class="text-blue-500 hover:text-blue-700 text-sm">编辑</button>
                                <button @click="deleteSub(index)" class="text-red-500 hover:text-red-700 text-sm">删除</button>
                            </div>
                        </div>
                        
                        <!-- Provider 模式切换 -->
                        <div class="flex items-center justify-between text-sm mt-2">
                            <div class="flex items-center space-x-4">
                                <label class="flex items-center space-x-2 cursor-pointer">
                                    <input type="checkbox" x-model="sub.useProvider" @change="toggleProvider(index)" 
                                           class="form-checkbox h-4 w-4 text-blue-600 rounded">
                                    <span class="text-gray-600">启用 provider</span>
                                </label>
                                
                                <label x-show="sub.useProvider" class="flex items-center space-x-2 cursor-pointer transition" x-cloak>
                                    <input type="checkbox" x-model="sub.autoUpdate" @change="toggleProvider(index)" 
                                           class="form-checkbox h-4 w-4 text-blue-600 rounded">
                                    <span class="text-gray-600">自动更新</span>
                                </label>
                            </div>
                            
                            <!-- 手动模式：显示更新按钮和时间 -->
                            <div x-show="!sub.useProvider" class="flex items-center space-x-2">
                                <button @click="updateSubscriptionNodes(index)" 
                                        class="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs transition">
                                    🔄 更新节点
                                </button>
                                <span x-show="sub.lastUpdate" x-text="'最后更新: ' + sub.lastUpdate" 
                                      class="text-[10px] text-gray-400"></span>
                            </div>
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
                
                // 切换 provider 模式
                async toggleProvider(index) {
                    const sub = this.subs[index];
                    try {
                        await fetch('/api/sub/update', {
                            method: 'POST',
                            headers: { 'x-admin-password': this.adminSavedPassword },
                            body: JSON.stringify({ 
                                index, 
                                name: sub.name, 
                                url: sub.url,
                                useProvider: sub.useProvider,
                                autoUpdate: sub.autoUpdate
                            })
                        });
                    } catch (e) {
                        this.setStatus('sub', '更新失败: ' + e.message, true);
                    }
                },
                
                // 更新订阅节点（手动模式）
                async updateSubscriptionNodes(index) {
                    const sub = this.subs[index];
                    this.setStatus('sub', '正在通过 Resolver 解析订阅...');
                    
                    try {
                        const res = await fetch('/api/sub/parse', {
                            method: 'POST',
                            headers: { 'x-admin-password': this.adminSavedPassword },
                            body: JSON.stringify({ index })
                        });
                        
                        let data;
                        try {
                            data = await res.json();
                        } catch (jsonErr) {
                            throw new Error('服务端返回非 JSON 响应 (HTTP ' + res.status + ')');
                        }
                        
                        if (!res.ok) throw new Error(data.error || '未知错误');
                        
                        // 更新最后更新时间
                        this.subs = data.subs;
                        this.setStatus('sub', '节点更新成功 (' + (data.nodeCount || '?') + ' 个节点)');
                    } catch (e) {
                        this.setStatus('sub', '解析失败: ' + e.message, true);
                    }
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

// ========================================
// 订阅解析功能（通过 SubResolver API）
// ========================================

/**
 * 转换为松散 JSON 格式（键不加引号，与 Clash 节点定义兼容）
 * 提取为模块级函数，供 processSubscription 和 convertNode 共用
 */
const module = { exports: {} };
const exports = module.exports;

// --- BEGIN JS-YAML (v4.1.0) ---
/*! js-yaml 4.1.0 https://github.com/nodeca/js-yaml @license MIT */

void function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):t((e="undefined"!=typeof globalThis?globalThis:e||self).jsyaml={})}(this,(function(e){"use strict";function t(e){return null==e}var n={isNothing:t,isObject:function(e){return"object"==typeof e&&null!==e},toArray:function(e){return Array.isArray(e)?e:t(e)?[]:[e]},repeat:function(e,t){var n,i="";for(n=0;n<t;n+=1)i+=e;return i},isNegativeZero:function(e){return 0===e&&Number.NEGATIVE_INFINITY===1/e},extend:function(e,t){var n,i,r,o;if(t)for(n=0,i=(o=Object.keys(t)).length;n<i;n+=1)e[r=o[n]]=t[r];return e}};function i(e,t){var n="",i=e.reason||"(unknown reason)";return e.mark?(e.mark.name&&(n+='in "'+e.mark.name+'" '),n+="("+(e.mark.line+1)+":"+(e.mark.column+1)+")",!t&&e.mark.snippet&&(n+="\n\n"+e.mark.snippet),i+" "+n):i}function r(e,t){Error.call(this),this.name="YAMLException",this.reason=e,this.mark=t,this.message=i(this,!1),Error.captureStackTrace?Error.captureStackTrace(this,this.constructor):this.stack=(new Error).stack||""}r.prototype=Object.create(Error.prototype),r.prototype.constructor=r,r.prototype.toString=function(e){return this.name+": "+i(this,e)};var o=r;function a(e,t,n,i,r){var o="",a="",l=Math.floor(r/2)-1;return i-t>l&&(t=i-l+(o=" ... ").length),n-i>l&&(n=i+l-(a=" ...").length),{str:o+e.slice(t,n).replace(/\t/g,"→")+a,pos:i-t+o.length}}function l(e,t){return n.repeat(" ",t-e.length)+e}var c=function(e,t){if(t=Object.create(t||null),!e.buffer)return null;t.maxLength||(t.maxLength=79),"number"!=typeof t.indent&&(t.indent=1),"number"!=typeof t.linesBefore&&(t.linesBefore=3),"number"!=typeof t.linesAfter&&(t.linesAfter=2);for(var i,r=/\r?\n|\r|\0/g,o=[0],c=[],s=-1;i=r.exec(e.buffer);)c.push(i.index),o.push(i.index+i[0].length),e.position<=i.index&&s<0&&(s=o.length-2);s<0&&(s=o.length-1);var u,p,f="",d=Math.min(e.line+t.linesAfter,c.length).toString().length,h=t.maxLength-(t.indent+d+3);for(u=1;u<=t.linesBefore&&!(s-u<0);u++)p=a(e.buffer,o[s-u],c[s-u],e.position-(o[s]-o[s-u]),h),f=n.repeat(" ",t.indent)+l((e.line-u+1).toString(),d)+" | "+p.str+"\n"+f;for(p=a(e.buffer,o[s],c[s],e.position,h),f+=n.repeat(" ",t.indent)+l((e.line+1).toString(),d)+" | "+p.str+"\n",f+=n.repeat("-",t.indent+d+3+p.pos)+"^\n",u=1;u<=t.linesAfter&&!(s+u>=c.length);u++)p=a(e.buffer,o[s+u],c[s+u],e.position-(o[s]-o[s+u]),h),f+=n.repeat(" ",t.indent)+l((e.line+u+1).toString(),d)+" | "+p.str+"\n";return f.replace(/\n$/,"")},s=["kind","multi","resolve","construct","instanceOf","predicate","represent","representName","defaultStyle","styleAliases"],u=["scalar","sequence","mapping"];var p=function(e,t){if(t=t||{},Object.keys(t).forEach((function(t){if(-1===s.indexOf(t))throw new o('Unknown option "'+t+'" is met in definition of "'+e+'" YAML type.')})),this.options=t,this.tag=e,this.kind=t.kind||null,this.resolve=t.resolve||function(){return!0},this.construct=t.construct||function(e){return e},this.instanceOf=t.instanceOf||null,this.predicate=t.predicate||null,this.represent=t.represent||null,this.representName=t.representName||null,this.defaultStyle=t.defaultStyle||null,this.multi=t.multi||!1,this.styleAliases=function(e){var t={};return null!==e&&Object.keys(e).forEach((function(n){e[n].forEach((function(e){t[String(e)]=n}))})),t}(t.styleAliases||null),-1===u.indexOf(this.kind))throw new o('Unknown kind "'+this.kind+'" is specified for "'+e+'" YAML type.')};function f(e,t){var n=[];return e[t].forEach((function(e){var t=n.length;n.forEach((function(n,i){n.tag===e.tag&&n.kind===e.kind&&n.multi===e.multi&&(t=i)})),n[t]=e})),n}function d(e){return this.extend(e)}d.prototype.extend=function(e){var t=[],n=[];if(e instanceof p)n.push(e);else if(Array.isArray(e))n=n.concat(e);else{if(!e||!Array.isArray(e.implicit)&&!Array.isArray(e.explicit))throw new o("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");e.implicit&&(t=t.concat(e.implicit)),e.explicit&&(n=n.concat(e.explicit))}t.forEach((function(e){if(!(e instanceof p))throw new o("Specified list of YAML types (or a single Type object) contains a non-Type object.");if(e.loadKind&&"scalar"!==e.loadKind)throw new o("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");if(e.multi)throw new o("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.")})),n.forEach((function(e){if(!(e instanceof p))throw new o("Specified list of YAML types (or a single Type object) contains a non-Type object.")}));var i=Object.create(d.prototype);return i.implicit=(this.implicit||[]).concat(t),i.explicit=(this.explicit||[]).concat(n),i.compiledImplicit=f(i,"implicit"),i.compiledExplicit=f(i,"explicit"),i.compiledTypeMap=function(){var e,t,n={scalar:{},sequence:{},mapping:{},fallback:{},multi:{scalar:[],sequence:[],mapping:[],fallback:[]}};function i(e){e.multi?(n.multi[e.kind].push(e),n.multi.fallback.push(e)):n[e.kind][e.tag]=n.fallback[e.tag]=e}for(e=0,t=arguments.length;e<t;e+=1)arguments[e].forEach(i);return n}(i.compiledImplicit,i.compiledExplicit),i};var h=d,g=new p("tag:yaml.org,2002:str",{kind:"scalar",construct:function(e){return null!==e?e:""}}),m=new p("tag:yaml.org,2002:seq",{kind:"sequence",construct:function(e){return null!==e?e:[]}}),y=new p("tag:yaml.org,2002:map",{kind:"mapping",construct:function(e){return null!==e?e:{}}}),b=new h({explicit:[g,m,y]});var A=new p("tag:yaml.org,2002:null",{kind:"scalar",resolve:function(e){if(null===e)return!0;var t=e.length;return 1===t&&"~"===e||4===t&&("null"===e||"Null"===e||"NULL"===e)},construct:function(){return null},predicate:function(e){return null===e},represent:{canonical:function(){return"~"},lowercase:function(){return"null"},uppercase:function(){return"NULL"},camelcase:function(){return"Null"},empty:function(){return""}},defaultStyle:"lowercase"});var v=new p("tag:yaml.org,2002:bool",{kind:"scalar",resolve:function(e){if(null===e)return!1;var t=e.length;return 4===t&&("true"===e||"True"===e||"TRUE"===e)||5===t&&("false"===e||"False"===e||"FALSE"===e)},construct:function(e){return"true"===e||"True"===e||"TRUE"===e},predicate:function(e){return"[object Boolean]"===Object.prototype.toString.call(e)},represent:{lowercase:function(e){return e?"true":"false"},uppercase:function(e){return e?"TRUE":"FALSE"},camelcase:function(e){return e?"True":"False"}},defaultStyle:"lowercase"});function w(e){return 48<=e&&e<=55}function k(e){return 48<=e&&e<=57}var C=new p("tag:yaml.org,2002:int",{kind:"scalar",resolve:function(e){if(null===e)return!1;var t,n,i=e.length,r=0,o=!1;if(!i)return!1;if("-"!==(t=e[r])&&"+"!==t||(t=e[++r]),"0"===t){if(r+1===i)return!0;if("b"===(t=e[++r])){for(r++;r<i;r++)if("_"!==(t=e[r])){if("0"!==t&&"1"!==t)return!1;o=!0}return o&&"_"!==t}if("x"===t){for(r++;r<i;r++)if("_"!==(t=e[r])){if(!(48<=(n=e.charCodeAt(r))&&n<=57||65<=n&&n<=70||97<=n&&n<=102))return!1;o=!0}return o&&"_"!==t}if("o"===t){for(r++;r<i;r++)if("_"!==(t=e[r])){if(!w(e.charCodeAt(r)))return!1;o=!0}return o&&"_"!==t}}if("_"===t)return!1;for(;r<i;r++)if("_"!==(t=e[r])){if(!k(e.charCodeAt(r)))return!1;o=!0}return!(!o||"_"===t)},construct:function(e){var t,n=e,i=1;if(-1!==n.indexOf("_")&&(n=n.replace(/_/g,"")),"-"!==(t=n[0])&&"+"!==t||("-"===t&&(i=-1),t=(n=n.slice(1))[0]),"0"===n)return 0;if("0"===t){if("b"===n[1])return i*parseInt(n.slice(2),2);if("x"===n[1])return i*parseInt(n.slice(2),16);if("o"===n[1])return i*parseInt(n.slice(2),8)}return i*parseInt(n,10)},predicate:function(e){return"[object Number]"===Object.prototype.toString.call(e)&&e%1==0&&!n.isNegativeZero(e)},represent:{binary:function(e){return e>=0?"0b"+e.toString(2):"-0b"+e.toString(2).slice(1)},octal:function(e){return e>=0?"0o"+e.toString(8):"-0o"+e.toString(8).slice(1)},decimal:function(e){return e.toString(10)},hexadecimal:function(e){return e>=0?"0x"+e.toString(16).toUpperCase():"-0x"+e.toString(16).toUpperCase().slice(1)}},defaultStyle:"decimal",styleAliases:{binary:[2,"bin"],octal:[8,"oct"],decimal:[10,"dec"],hexadecimal:[16,"hex"]}}),x=new RegExp("^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");var I=/^[-+]?[0-9]+e/;var S=new p("tag:yaml.org,2002:float",{kind:"scalar",resolve:function(e){return null!==e&&!(!x.test(e)||"_"===e[e.length-1])},construct:function(e){var t,n;return n="-"===(t=e.replace(/_/g,"").toLowerCase())[0]?-1:1,"+-".indexOf(t[0])>=0&&(t=t.slice(1)),".inf"===t?1===n?Number.POSITIVE_INFINITY:Number.NEGATIVE_INFINITY:".nan"===t?NaN:n*parseFloat(t,10)},predicate:function(e){return"[object Number]"===Object.prototype.toString.call(e)&&(e%1!=0||n.isNegativeZero(e))},represent:function(e,t){var i;if(isNaN(e))switch(t){case"lowercase":return".nan";case"uppercase":return".NAN";case"camelcase":return".NaN"}else if(Number.POSITIVE_INFINITY===e)switch(t){case"lowercase":return".inf";case"uppercase":return".INF";case"camelcase":return".Inf"}else if(Number.NEGATIVE_INFINITY===e)switch(t){case"lowercase":return"-.inf";case"uppercase":return"-.INF";case"camelcase":return"-.Inf"}else if(n.isNegativeZero(e))return"-0.0";return i=e.toString(10),I.test(i)?i.replace("e",".e"):i},defaultStyle:"lowercase"}),O=b.extend({implicit:[A,v,C,S]}),j=O,T=new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"),N=new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$");var F=new p("tag:yaml.org,2002:timestamp",{kind:"scalar",resolve:function(e){return null!==e&&(null!==T.exec(e)||null!==N.exec(e))},construct:function(e){var t,n,i,r,o,a,l,c,s=0,u=null;if(null===(t=T.exec(e))&&(t=N.exec(e)),null===t)throw new Error("Date resolve error");if(n=+t[1],i=+t[2]-1,r=+t[3],!t[4])return new Date(Date.UTC(n,i,r));if(o=+t[4],a=+t[5],l=+t[6],t[7]){for(s=t[7].slice(0,3);s.length<3;)s+="0";s=+s}return t[9]&&(u=6e4*(60*+t[10]+ +(t[11]||0)),"-"===t[9]&&(u=-u)),c=new Date(Date.UTC(n,i,r,o,a,l,s)),u&&c.setTime(c.getTime()-u),c},instanceOf:Date,represent:function(e){return e.toISOString()}});var E=new p("tag:yaml.org,2002:merge",{kind:"scalar",resolve:function(e){return"<<"===e||null===e}}),M="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";var L=new p("tag:yaml.org,2002:binary",{kind:"scalar",resolve:function(e){if(null===e)return!1;var t,n,i=0,r=e.length,o=M;for(n=0;n<r;n++)if(!((t=o.indexOf(e.charAt(n)))>64)){if(t<0)return!1;i+=6}return i%8==0},construct:function(e){var t,n,i=e.replace(/[\r\n=]/g,""),r=i.length,o=M,a=0,l=[];for(t=0;t<r;t++)t%4==0&&t&&(l.push(a>>16&255),l.push(a>>8&255),l.push(255&a)),a=a<<6|o.indexOf(i.charAt(t));return 0===(n=r%4*6)?(l.push(a>>16&255),l.push(a>>8&255),l.push(255&a)):18===n?(l.push(a>>10&255),l.push(a>>2&255)):12===n&&l.push(a>>4&255),new Uint8Array(l)},predicate:function(e){return"[object Uint8Array]"===Object.prototype.toString.call(e)},represent:function(e){var t,n,i="",r=0,o=e.length,a=M;for(t=0;t<o;t++)t%3==0&&t&&(i+=a[r>>18&63],i+=a[r>>12&63],i+=a[r>>6&63],i+=a[63&r]),r=(r<<8)+e[t];return 0===(n=o%3)?(i+=a[r>>18&63],i+=a[r>>12&63],i+=a[r>>6&63],i+=a[63&r]):2===n?(i+=a[r>>10&63],i+=a[r>>4&63],i+=a[r<<2&63],i+=a[64]):1===n&&(i+=a[r>>2&63],i+=a[r<<4&63],i+=a[64],i+=a[64]),i}}),_=Object.prototype.hasOwnProperty,D=Object.prototype.toString;var U=new p("tag:yaml.org,2002:omap",{kind:"sequence",resolve:function(e){if(null===e)return!0;var t,n,i,r,o,a=[],l=e;for(t=0,n=l.length;t<n;t+=1){if(i=l[t],o=!1,"[object Object]"!==D.call(i))return!1;for(r in i)if(_.call(i,r)){if(o)return!1;o=!0}if(!o)return!1;if(-1!==a.indexOf(r))return!1;a.push(r)}return!0},construct:function(e){return null!==e?e:[]}}),q=Object.prototype.toString;var Y=new p("tag:yaml.org,2002:pairs",{kind:"sequence",resolve:function(e){if(null===e)return!0;var t,n,i,r,o,a=e;for(o=new Array(a.length),t=0,n=a.length;t<n;t+=1){if(i=a[t],"[object Object]"!==q.call(i))return!1;if(1!==(r=Object.keys(i)).length)return!1;o[t]=[r[0],i[r[0]]]}return!0},construct:function(e){if(null===e)return[];var t,n,i,r,o,a=e;for(o=new Array(a.length),t=0,n=a.length;t<n;t+=1)i=a[t],r=Object.keys(i),o[t]=[r[0],i[r[0]]];return o}}),R=Object.prototype.hasOwnProperty;var B=new p("tag:yaml.org,2002:set",{kind:"mapping",resolve:function(e){if(null===e)return!0;var t,n=e;for(t in n)if(R.call(n,t)&&null!==n[t])return!1;return!0},construct:function(e){return null!==e?e:{}}}),K=j.extend({implicit:[F,E],explicit:[L,U,Y,B]}),P=Object.prototype.hasOwnProperty,W=/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/,H=/[\x85\u2028\u2029]/,$=/[,\[\]\{\}]/,G=/^(?:!|!!|![a-z\-]+!)$/i,V=/^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;function Z(e){return Object.prototype.toString.call(e)}function J(e){return 10===e||13===e}function Q(e){return 9===e||32===e}function z(e){return 9===e||32===e||10===e||13===e}function X(e){return 44===e||91===e||93===e||123===e||125===e}function ee(e){var t;return 48<=e&&e<=57?e-48:97<=(t=32|e)&&t<=102?t-97+10:-1}function te(e){return 48===e?"\0":97===e?"":98===e?"\b":116===e||9===e?"\t":110===e?"\n":118===e?"\v":102===e?"\f":114===e?"\r":101===e?"":32===e?" ":34===e?'"':47===e?"/":92===e?"\\":78===e?"":95===e?" ":76===e?"\u2028":80===e?"\u2029":""}function ne(e){return e<=65535?String.fromCharCode(e):String.fromCharCode(55296+(e-65536>>10),56320+(e-65536&1023))}for(var ie=new Array(256),re=new Array(256),oe=0;oe<256;oe++)ie[oe]=te(oe)?1:0,re[oe]=te(oe);function ae(e,t){this.input=e,this.filename=t.filename||null,this.schema=t.schema||K,this.onWarning=t.onWarning||null,this.legacy=t.legacy||!1,this.json=t.json||!1,this.listener=t.listener||null,this.implicitTypes=this.schema.compiledImplicit,this.typeMap=this.schema.compiledTypeMap,this.length=e.length,this.position=0,this.line=0,this.lineStart=0,this.lineIndent=0,this.firstTabInLine=-1,this.documents=[]}function le(e,t){var n={name:e.filename,buffer:e.input.slice(0,-1),position:e.position,line:e.line,column:e.position-e.lineStart};return n.snippet=c(n),new o(t,n)}function ce(e,t){throw le(e,t)}function se(e,t){e.onWarning&&e.onWarning.call(null,le(e,t))}var ue={YAML:function(e,t,n){var i,r,o;null!==e.version&&ce(e,"duplication of %YAML directive"),1!==n.length&&ce(e,"YAML directive accepts exactly one argument"),null===(i=/^([0-9]+)\.([0-9]+)$/.exec(n[0]))&&ce(e,"ill-formed argument of the YAML directive"),r=parseInt(i[1],10),o=parseInt(i[2],10),1!==r&&ce(e,"unacceptable YAML version of the document"),e.version=n[0],e.checkLineBreaks=o<2,1!==o&&2!==o&&se(e,"unsupported YAML version of the document")},TAG:function(e,t,n){var i,r;2!==n.length&&ce(e,"TAG directive accepts exactly two arguments"),i=n[0],r=n[1],G.test(i)||ce(e,"ill-formed tag handle (first argument) of the TAG directive"),P.call(e.tagMap,i)&&ce(e,'there is a previously declared suffix for "'+i+'" tag handle'),V.test(r)||ce(e,"ill-formed tag prefix (second argument) of the TAG directive");try{r=decodeURIComponent(r)}catch(t){ce(e,"tag prefix is malformed: "+r)}e.tagMap[i]=r}};function pe(e,t,n,i){var r,o,a,l;if(t<n){if(l=e.input.slice(t,n),i)for(r=0,o=l.length;r<o;r+=1)9===(a=l.charCodeAt(r))||32<=a&&a<=1114111||ce(e,"expected valid JSON character");else W.test(l)&&ce(e,"the stream contains non-printable characters");e.result+=l}}function fe(e,t,i,r){var o,a,l,c;for(n.isObject(i)||ce(e,"cannot merge mappings; the provided source object is unacceptable"),l=0,c=(o=Object.keys(i)).length;l<c;l+=1)a=o[l],P.call(t,a)||(t[a]=i[a],r[a]=!0)}function de(e,t,n,i,r,o,a,l,c){var s,u;if(Array.isArray(r))for(s=0,u=(r=Array.prototype.slice.call(r)).length;s<u;s+=1)Array.isArray(r[s])&&ce(e,"nested arrays are not supported inside keys"),"object"==typeof r&&"[object Object]"===Z(r[s])&&(r[s]="[object Object]");if("object"==typeof r&&"[object Object]"===Z(r)&&(r="[object Object]"),r=String(r),null===t&&(t={}),"tag:yaml.org,2002:merge"===i)if(Array.isArray(o))for(s=0,u=o.length;s<u;s+=1)fe(e,t,o[s],n);else fe(e,t,o,n);else e.json||P.call(n,r)||!P.call(t,r)||(e.line=a||e.line,e.lineStart=l||e.lineStart,e.position=c||e.position,ce(e,"duplicated mapping key")),"__proto__"===r?Object.defineProperty(t,r,{configurable:!0,enumerable:!0,writable:!0,value:o}):t[r]=o,delete n[r];return t}function he(e){var t;10===(t=e.input.charCodeAt(e.position))?e.position++:13===t?(e.position++,10===e.input.charCodeAt(e.position)&&e.position++):ce(e,"a line break is expected"),e.line+=1,e.lineStart=e.position,e.firstTabInLine=-1}function ge(e,t,n){for(var i=0,r=e.input.charCodeAt(e.position);0!==r;){for(;Q(r);)9===r&&-1===e.firstTabInLine&&(e.firstTabInLine=e.position),r=e.input.charCodeAt(++e.position);if(t&&35===r)do{r=e.input.charCodeAt(++e.position)}while(10!==r&&13!==r&&0!==r);if(!J(r))break;for(he(e),r=e.input.charCodeAt(e.position),i++,e.lineIndent=0;32===r;)e.lineIndent++,r=e.input.charCodeAt(++e.position)}return-1!==n&&0!==i&&e.lineIndent<n&&se(e,"deficient indentation"),i}function me(e){var t,n=e.position;return!(45!==(t=e.input.charCodeAt(n))&&46!==t||t!==e.input.charCodeAt(n+1)||t!==e.input.charCodeAt(n+2)||(n+=3,0!==(t=e.input.charCodeAt(n))&&!z(t)))}function ye(e,t){1===t?e.result+=" ":t>1&&(e.result+=n.repeat("\n",t-1))}function be(e,t){var n,i,r=e.tag,o=e.anchor,a=[],l=!1;if(-1!==e.firstTabInLine)return!1;for(null!==e.anchor&&(e.anchorMap[e.anchor]=a),i=e.input.charCodeAt(e.position);0!==i&&(-1!==e.firstTabInLine&&(e.position=e.firstTabInLine,ce(e,"tab characters must not be used in indentation")),45===i)&&z(e.input.charCodeAt(e.position+1));)if(l=!0,e.position++,ge(e,!0,-1)&&e.lineIndent<=t)a.push(null),i=e.input.charCodeAt(e.position);else if(n=e.line,we(e,t,3,!1,!0),a.push(e.result),ge(e,!0,-1),i=e.input.charCodeAt(e.position),(e.line===n||e.lineIndent>t)&&0!==i)ce(e,"bad indentation of a sequence entry");else if(e.lineIndent<t)break;return!!l&&(e.tag=r,e.anchor=o,e.kind="sequence",e.result=a,!0)}function Ae(e){var t,n,i,r,o=!1,a=!1;if(33!==(r=e.input.charCodeAt(e.position)))return!1;if(null!==e.tag&&ce(e,"duplication of a tag property"),60===(r=e.input.charCodeAt(++e.position))?(o=!0,r=e.input.charCodeAt(++e.position)):33===r?(a=!0,n="!!",r=e.input.charCodeAt(++e.position)):n="!",t=e.position,o){do{r=e.input.charCodeAt(++e.position)}while(0!==r&&62!==r);e.position<e.length?(i=e.input.slice(t,e.position),r=e.input.charCodeAt(++e.position)):ce(e,"unexpected end of the stream within a verbatim tag")}else{for(;0!==r&&!z(r);)33===r&&(a?ce(e,"tag suffix cannot contain exclamation marks"):(n=e.input.slice(t-1,e.position+1),G.test(n)||ce(e,"named tag handle cannot contain such characters"),a=!0,t=e.position+1)),r=e.input.charCodeAt(++e.position);i=e.input.slice(t,e.position),$.test(i)&&ce(e,"tag suffix cannot contain flow indicator characters")}i&&!V.test(i)&&ce(e,"tag name cannot contain such characters: "+i);try{i=decodeURIComponent(i)}catch(t){ce(e,"tag name is malformed: "+i)}return o?e.tag=i:P.call(e.tagMap,n)?e.tag=e.tagMap[n]+i:"!"===n?e.tag="!"+i:"!!"===n?e.tag="tag:yaml.org,2002:"+i:ce(e,'undeclared tag handle "'+n+'"'),!0}function ve(e){var t,n;if(38!==(n=e.input.charCodeAt(e.position)))return!1;for(null!==e.anchor&&ce(e,"duplication of an anchor property"),n=e.input.charCodeAt(++e.position),t=e.position;0!==n&&!z(n)&&!X(n);)n=e.input.charCodeAt(++e.position);return e.position===t&&ce(e,"name of an anchor node must contain at least one character"),e.anchor=e.input.slice(t,e.position),!0}function we(e,t,i,r,o){var a,l,c,s,u,p,f,d,h,g=1,m=!1,y=!1;if(null!==e.listener&&e.listener("open",e),e.tag=null,e.anchor=null,e.kind=null,e.result=null,a=l=c=4===i||3===i,r&&ge(e,!0,-1)&&(m=!0,e.lineIndent>t?g=1:e.lineIndent===t?g=0:e.lineIndent<t&&(g=-1)),1===g)for(;Ae(e)||ve(e);)ge(e,!0,-1)?(m=!0,c=a,e.lineIndent>t?g=1:e.lineIndent===t?g=0:e.lineIndent<t&&(g=-1)):c=!1;if(c&&(c=m||o),1!==g&&4!==i||(d=1===i||2===i?t:t+1,h=e.position-e.lineStart,1===g?c&&(be(e,h)||function(e,t,n){var i,r,o,a,l,c,s,u=e.tag,p=e.anchor,f={},d=Object.create(null),h=null,g=null,m=null,y=!1,b=!1;if(-1!==e.firstTabInLine)return!1;for(null!==e.anchor&&(e.anchorMap[e.anchor]=f),s=e.input.charCodeAt(e.position);0!==s;){if(y||-1===e.firstTabInLine||(e.position=e.firstTabInLine,ce(e,"tab characters must not be used in indentation")),i=e.input.charCodeAt(e.position+1),o=e.line,63!==s&&58!==s||!z(i)){if(a=e.line,l=e.lineStart,c=e.position,!we(e,n,2,!1,!0))break;if(e.line===o){for(s=e.input.charCodeAt(e.position);Q(s);)s=e.input.charCodeAt(++e.position);if(58===s)z(s=e.input.charCodeAt(++e.position))||ce(e,"a whitespace character is expected after the key-value separator within a block mapping"),y&&(de(e,f,d,h,g,null,a,l,c),h=g=m=null),b=!0,y=!1,r=!1,h=e.tag,g=e.result;else{if(!b)return e.tag=u,e.anchor=p,!0;ce(e,"can not read an implicit mapping pair; a colon is missed")}}else{if(!b)return e.tag=u,e.anchor=p,!0;ce(e,"can not read a block mapping entry; a multiline key may not be an implicit key")}}else 63===s?(y&&(de(e,f,d,h,g,null,a,l,c),h=g=m=null),b=!0,y=!0,r=!0):y?(y=!1,r=!0):ce(e,"incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line"),e.position+=1,s=i;if((e.line===o||e.lineIndent>t)&&(y&&(a=e.line,l=e.lineStart,c=e.position),we(e,t,4,!0,r)&&(y?g=e.result:m=e.result),y||(de(e,f,d,h,g,m,a,l,c),h=g=m=null),ge(e,!0,-1),s=e.input.charCodeAt(e.position)),(e.line===o||e.lineIndent>t)&&0!==s)ce(e,"bad indentation of a mapping entry");else if(e.lineIndent<t)break}return y&&de(e,f,d,h,g,null,a,l,c),b&&(e.tag=u,e.anchor=p,e.kind="mapping",e.result=f),b}(e,h,d))||function(e,t){var n,i,r,o,a,l,c,s,u,p,f,d,h=!0,g=e.tag,m=e.anchor,y=Object.create(null);if(91===(d=e.input.charCodeAt(e.position)))a=93,s=!1,o=[];else{if(123!==d)return!1;a=125,s=!0,o={}}for(null!==e.anchor&&(e.anchorMap[e.anchor]=o),d=e.input.charCodeAt(++e.position);0!==d;){if(ge(e,!0,t),(d=e.input.charCodeAt(e.position))===a)return e.position++,e.tag=g,e.anchor=m,e.kind=s?"mapping":"sequence",e.result=o,!0;h?44===d&&ce(e,"expected the node content, but found ','"):ce(e,"missed comma between flow collection entries"),f=null,l=c=!1,63===d&&z(e.input.charCodeAt(e.position+1))&&(l=c=!0,e.position++,ge(e,!0,t)),n=e.line,i=e.lineStart,r=e.position,we(e,t,1,!1,!0),p=e.tag,u=e.result,ge(e,!0,t),d=e.input.charCodeAt(e.position),!c&&e.line!==n||58!==d||(l=!0,d=e.input.charCodeAt(++e.position),ge(e,!0,t),we(e,t,1,!1,!0),f=e.result),s?de(e,o,y,p,u,f,n,i,r):l?o.push(de(e,null,y,p,u,f,n,i,r)):o.push(u),ge(e,!0,t),44===(d=e.input.charCodeAt(e.position))?(h=!0,d=e.input.charCodeAt(++e.position)):h=!1}ce(e,"unexpected end of the stream within a flow collection")}(e,d)?y=!0:(l&&function(e,t){var i,r,o,a,l,c=1,s=!1,u=!1,p=t,f=0,d=!1;if(124===(a=e.input.charCodeAt(e.position)))r=!1;else{if(62!==a)return!1;r=!0}for(e.kind="scalar",e.result="";0!==a;)if(43===(a=e.input.charCodeAt(++e.position))||45===a)1===c?c=43===a?3:2:ce(e,"repeat of a chomping mode identifier");else{if(!((o=48<=(l=a)&&l<=57?l-48:-1)>=0))break;0===o?ce(e,"bad explicit indentation width of a block scalar; it cannot be less than one"):u?ce(e,"repeat of an indentation width identifier"):(p=t+o-1,u=!0)}if(Q(a)){do{a=e.input.charCodeAt(++e.position)}while(Q(a));if(35===a)do{a=e.input.charCodeAt(++e.position)}while(!J(a)&&0!==a)}for(;0!==a;){for(he(e),e.lineIndent=0,a=e.input.charCodeAt(e.position);(!u||e.lineIndent<p)&&32===a;)e.lineIndent++,a=e.input.charCodeAt(++e.position);if(!u&&e.lineIndent>p&&(p=e.lineIndent),J(a))f++;else{if(e.lineIndent<p){3===c?e.result+=n.repeat("\n",s?1+f:f):1===c&&s&&(e.result+="\n");break}for(r?Q(a)?(d=!0,e.result+=n.repeat("\n",s?1+f:f)):d?(d=!1,e.result+=n.repeat("\n",f+1)):0===f?s&&(e.result+=" "):e.result+=n.repeat("\n",f):e.result+=n.repeat("\n",s?1+f:f),s=!0,u=!0,f=0,i=e.position;!J(a)&&0!==a;)a=e.input.charCodeAt(++e.position);pe(e,i,e.position,!1)}}return!0}(e,d)||function(e,t){var n,i,r;if(39!==(n=e.input.charCodeAt(e.position)))return!1;for(e.kind="scalar",e.result="",e.position++,i=r=e.position;0!==(n=e.input.charCodeAt(e.position));)if(39===n){if(pe(e,i,e.position,!0),39!==(n=e.input.charCodeAt(++e.position)))return!0;i=e.position,e.position++,r=e.position}else J(n)?(pe(e,i,r,!0),ye(e,ge(e,!1,t)),i=r=e.position):e.position===e.lineStart&&me(e)?ce(e,"unexpected end of the document within a single quoted scalar"):(e.position++,r=e.position);ce(e,"unexpected end of the stream within a single quoted scalar")}(e,d)||function(e,t){var n,i,r,o,a,l,c;if(34!==(l=e.input.charCodeAt(e.position)))return!1;for(e.kind="scalar",e.result="",e.position++,n=i=e.position;0!==(l=e.input.charCodeAt(e.position));){if(34===l)return pe(e,n,e.position,!0),e.position++,!0;if(92===l){if(pe(e,n,e.position,!0),J(l=e.input.charCodeAt(++e.position)))ge(e,!1,t);else if(l<256&&ie[l])e.result+=re[l],e.position++;else if((a=120===(c=l)?2:117===c?4:85===c?8:0)>0){for(r=a,o=0;r>0;r--)(a=ee(l=e.input.charCodeAt(++e.position)))>=0?o=(o<<4)+a:ce(e,"expected hexadecimal character");e.result+=ne(o),e.position++}else ce(e,"unknown escape sequence");n=i=e.position}else J(l)?(pe(e,n,i,!0),ye(e,ge(e,!1,t)),n=i=e.position):e.position===e.lineStart&&me(e)?ce(e,"unexpected end of the document within a double quoted scalar"):(e.position++,i=e.position)}ce(e,"unexpected end of the stream within a double quoted scalar")}(e,d)?y=!0:!function(e){var t,n,i;if(42!==(i=e.input.charCodeAt(e.position)))return!1;for(i=e.input.charCodeAt(++e.position),t=e.position;0!==i&&!z(i)&&!X(i);)i=e.input.charCodeAt(++e.position);return e.position===t&&ce(e,"name of an alias node must contain at least one character"),n=e.input.slice(t,e.position),P.call(e.anchorMap,n)||ce(e,'unidentified alias "'+n+'"'),e.result=e.anchorMap[n],ge(e,!0,-1),!0}(e)?function(e,t,n){var i,r,o,a,l,c,s,u,p=e.kind,f=e.result;if(z(u=e.input.charCodeAt(e.position))||X(u)||35===u||38===u||42===u||33===u||124===u||62===u||39===u||34===u||37===u||64===u||96===u)return!1;if((63===u||45===u)&&(z(i=e.input.charCodeAt(e.position+1))||n&&X(i)))return!1;for(e.kind="scalar",e.result="",r=o=e.position,a=!1;0!==u;){if(58===u){if(z(i=e.input.charCodeAt(e.position+1))||n&&X(i))break}else if(35===u){if(z(e.input.charCodeAt(e.position-1)))break}else{if(e.position===e.lineStart&&me(e)||n&&X(u))break;if(J(u)){if(l=e.line,c=e.lineStart,s=e.lineIndent,ge(e,!1,-1),e.lineIndent>=t){a=!0,u=e.input.charCodeAt(e.position);continue}e.position=o,e.line=l,e.lineStart=c,e.lineIndent=s;break}}a&&(pe(e,r,o,!1),ye(e,e.line-l),r=o=e.position,a=!1),Q(u)||(o=e.position+1),u=e.input.charCodeAt(++e.position)}return pe(e,r,o,!1),!!e.result||(e.kind=p,e.result=f,!1)}(e,d,1===i)&&(y=!0,null===e.tag&&(e.tag="?")):(y=!0,null===e.tag&&null===e.anchor||ce(e,"alias node should not have any properties")),null!==e.anchor&&(e.anchorMap[e.anchor]=e.result)):0===g&&(y=c&&be(e,h))),null===e.tag)null!==e.anchor&&(e.anchorMap[e.anchor]=e.result);else if("?"===e.tag){for(null!==e.result&&"scalar"!==e.kind&&ce(e,'unacceptable node kind for !<?> tag; it should be "scalar", not "'+e.kind+'"'),s=0,u=e.implicitTypes.length;s<u;s+=1)if((f=e.implicitTypes[s]).resolve(e.result)){e.result=f.construct(e.result),e.tag=f.tag,null!==e.anchor&&(e.anchorMap[e.anchor]=e.result);break}}else if("!"!==e.tag){if(P.call(e.typeMap[e.kind||"fallback"],e.tag))f=e.typeMap[e.kind||"fallback"][e.tag];else for(f=null,s=0,u=(p=e.typeMap.multi[e.kind||"fallback"]).length;s<u;s+=1)if(e.tag.slice(0,p[s].tag.length)===p[s].tag){f=p[s];break}f||ce(e,"unknown tag !<"+e.tag+">"),null!==e.result&&f.kind!==e.kind&&ce(e,"unacceptable node kind for !<"+e.tag+'> tag; it should be "'+f.kind+'", not "'+e.kind+'"'),f.resolve(e.result,e.tag)?(e.result=f.construct(e.result,e.tag),null!==e.anchor&&(e.anchorMap[e.anchor]=e.result)):ce(e,"cannot resolve a node with !<"+e.tag+"> explicit tag")}return null!==e.listener&&e.listener("close",e),null!==e.tag||null!==e.anchor||y}function ke(e){var t,n,i,r,o=e.position,a=!1;for(e.version=null,e.checkLineBreaks=e.legacy,e.tagMap=Object.create(null),e.anchorMap=Object.create(null);0!==(r=e.input.charCodeAt(e.position))&&(ge(e,!0,-1),r=e.input.charCodeAt(e.position),!(e.lineIndent>0||37!==r));){for(a=!0,r=e.input.charCodeAt(++e.position),t=e.position;0!==r&&!z(r);)r=e.input.charCodeAt(++e.position);for(i=[],(n=e.input.slice(t,e.position)).length<1&&ce(e,"directive name must not be less than one character in length");0!==r;){for(;Q(r);)r=e.input.charCodeAt(++e.position);if(35===r){do{r=e.input.charCodeAt(++e.position)}while(0!==r&&!J(r));break}if(J(r))break;for(t=e.position;0!==r&&!z(r);)r=e.input.charCodeAt(++e.position);i.push(e.input.slice(t,e.position))}0!==r&&he(e),P.call(ue,n)?ue[n](e,n,i):se(e,'unknown document directive "'+n+'"')}ge(e,!0,-1),0===e.lineIndent&&45===e.input.charCodeAt(e.position)&&45===e.input.charCodeAt(e.position+1)&&45===e.input.charCodeAt(e.position+2)?(e.position+=3,ge(e,!0,-1)):a&&ce(e,"directives end mark is expected"),we(e,e.lineIndent-1,4,!1,!0),ge(e,!0,-1),e.checkLineBreaks&&H.test(e.input.slice(o,e.position))&&se(e,"non-ASCII line breaks are interpreted as content"),e.documents.push(e.result),e.position===e.lineStart&&me(e)?46===e.input.charCodeAt(e.position)&&(e.position+=3,ge(e,!0,-1)):e.position<e.length-1&&ce(e,"end of the stream or a document separator is expected")}function Ce(e,t){t=t||{},0!==(e=String(e)).length&&(10!==e.charCodeAt(e.length-1)&&13!==e.charCodeAt(e.length-1)&&(e+="\n"),65279===e.charCodeAt(0)&&(e=e.slice(1)));var n=new ae(e,t),i=e.indexOf("\0");for(-1!==i&&(n.position=i,ce(n,"null byte is not allowed in input")),n.input+="\0";32===n.input.charCodeAt(n.position);)n.lineIndent+=1,n.position+=1;for(;n.position<n.length-1;)ke(n);return n.documents}var xe={loadAll:function(e,t,n){null!==t&&"object"==typeof t&&void 0===n&&(n=t,t=null);var i=Ce(e,n);if("function"!=typeof t)return i;for(var r=0,o=i.length;r<o;r+=1)t(i[r])},load:function(e,t){var n=Ce(e,t);if(0!==n.length){if(1===n.length)return n[0];throw new o("expected a single document in the stream, but found more")}}},Ie=Object.prototype.toString,Se=Object.prototype.hasOwnProperty,Oe=65279,je={0:"\\0",7:"\\a",8:"\\b",9:"\\t",10:"\\n",11:"\\v",12:"\\f",13:"\\r",27:"\\e",34:'\\"',92:"\\\\",133:"\\N",160:"\\_",8232:"\\L",8233:"\\P"},Te=["y","Y","yes","Yes","YES","on","On","ON","n","N","no","No","NO","off","Off","OFF"],Ne=/^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;function Fe(e){var t,i,r;if(t=e.toString(16).toUpperCase(),e<=255)i="x",r=2;else if(e<=65535)i="u",r=4;else{if(!(e<=4294967295))throw new o("code point within a string may not be greater than 0xFFFFFFFF");i="U",r=8}return"\\"+i+n.repeat("0",r-t.length)+t}function Ee(e){this.schema=e.schema||K,this.indent=Math.max(1,e.indent||2),this.noArrayIndent=e.noArrayIndent||!1,this.skipInvalid=e.skipInvalid||!1,this.flowLevel=n.isNothing(e.flowLevel)?-1:e.flowLevel,this.styleMap=function(e,t){var n,i,r,o,a,l,c;if(null===t)return{};for(n={},r=0,o=(i=Object.keys(t)).length;r<o;r+=1)a=i[r],l=String(t[a]),"!!"===a.slice(0,2)&&(a="tag:yaml.org,2002:"+a.slice(2)),(c=e.compiledTypeMap.fallback[a])&&Se.call(c.styleAliases,l)&&(l=c.styleAliases[l]),n[a]=l;return n}(this.schema,e.styles||null),this.sortKeys=e.sortKeys||!1,this.lineWidth=e.lineWidth||80,this.noRefs=e.noRefs||!1,this.noCompatMode=e.noCompatMode||!1,this.condenseFlow=e.condenseFlow||!1,this.quotingType='"'===e.quotingType?2:1,this.forceQuotes=e.forceQuotes||!1,this.replacer="function"==typeof e.replacer?e.replacer:null,this.implicitTypes=this.schema.compiledImplicit,this.explicitTypes=this.schema.compiledExplicit,this.tag=null,this.result="",this.duplicates=[],this.usedDuplicates=null}function Me(e,t){for(var i,r=n.repeat(" ",t),o=0,a=-1,l="",c=e.length;o<c;)-1===(a=e.indexOf("\n",o))?(i=e.slice(o),o=c):(i=e.slice(o,a+1),o=a+1),i.length&&"\n"!==i&&(l+=r),l+=i;return l}function Le(e,t){return"\n"+n.repeat(" ",e.indent*t)}function _e(e){return 32===e||9===e}function De(e){return 32<=e&&e<=126||161<=e&&e<=55295&&8232!==e&&8233!==e||57344<=e&&e<=65533&&e!==Oe||65536<=e&&e<=1114111}function Ue(e){return De(e)&&e!==Oe&&13!==e&&10!==e}function qe(e,t,n){var i=Ue(e),r=i&&!_e(e);return(n?i:i&&44!==e&&91!==e&&93!==e&&123!==e&&125!==e)&&35!==e&&!(58===t&&!r)||Ue(t)&&!_e(t)&&35===e||58===t&&r}function Ye(e,t){var n,i=e.charCodeAt(t);return i>=55296&&i<=56319&&t+1<e.length&&(n=e.charCodeAt(t+1))>=56320&&n<=57343?1024*(i-55296)+n-56320+65536:i}function Re(e){return/^\n* /.test(e)}function Be(e,t,n,i,r,o,a,l){var c,s,u=0,p=null,f=!1,d=!1,h=-1!==i,g=-1,m=De(s=Ye(e,0))&&s!==Oe&&!_e(s)&&45!==s&&63!==s&&58!==s&&44!==s&&91!==s&&93!==s&&123!==s&&125!==s&&35!==s&&38!==s&&42!==s&&33!==s&&124!==s&&61!==s&&62!==s&&39!==s&&34!==s&&37!==s&&64!==s&&96!==s&&function(e){return!_e(e)&&58!==e}(Ye(e,e.length-1));if(t||a)for(c=0;c<e.length;u>=65536?c+=2:c++){if(!De(u=Ye(e,c)))return 5;m=m&&qe(u,p,l),p=u}else{for(c=0;c<e.length;u>=65536?c+=2:c++){if(10===(u=Ye(e,c)))f=!0,h&&(d=d||c-g-1>i&&" "!==e[g+1],g=c);else if(!De(u))return 5;m=m&&qe(u,p,l),p=u}d=d||h&&c-g-1>i&&" "!==e[g+1]}return f||d?n>9&&Re(e)?5:a?2===o?5:2:d?4:3:!m||a||r(e)?2===o?5:2:1}function Ke(e,t,n,i,r){e.dump=function(){if(0===t.length)return 2===e.quotingType?'""':"''";if(!e.noCompatMode&&(-1!==Te.indexOf(t)||Ne.test(t)))return 2===e.quotingType?'"'+t+'"':"'"+t+"'";var a=e.indent*Math.max(1,n),l=-1===e.lineWidth?-1:Math.max(Math.min(e.lineWidth,40),e.lineWidth-a),c=i||e.flowLevel>-1&&n>=e.flowLevel;switch(Be(t,c,e.indent,l,(function(t){return function(e,t){var n,i;for(n=0,i=e.implicitTypes.length;n<i;n+=1)if(e.implicitTypes[n].resolve(t))return!0;return!1}(e,t)}),e.quotingType,e.forceQuotes&&!i,r)){case 1:return t;case 2:return"'"+t.replace(/'/g,"''")+"'";case 3:return"|"+Pe(t,e.indent)+We(Me(t,a));case 4:return">"+Pe(t,e.indent)+We(Me(function(e,t){var n,i,r=/(\n+)([^\n]*)/g,o=(l=e.indexOf("\n"),l=-1!==l?l:e.length,r.lastIndex=l,He(e.slice(0,l),t)),a="\n"===e[0]||" "===e[0];var l;for(;i=r.exec(e);){var c=i[1],s=i[2];n=" "===s[0],o+=c+(a||n||""===s?"":"\n")+He(s,t),a=n}return o}(t,l),a));case 5:return'"'+function(e){for(var t,n="",i=0,r=0;r<e.length;i>=65536?r+=2:r++)i=Ye(e,r),!(t=je[i])&&De(i)?(n+=e[r],i>=65536&&(n+=e[r+1])):n+=t||Fe(i);return n}(t)+'"';default:throw new o("impossible error: invalid scalar style")}}()}function Pe(e,t){var n=Re(e)?String(t):"",i="\n"===e[e.length-1];return n+(i&&("\n"===e[e.length-2]||"\n"===e)?"+":i?"":"-")+"\n"}function We(e){return"\n"===e[e.length-1]?e.slice(0,-1):e}function He(e,t){if(""===e||" "===e[0])return e;for(var n,i,r=/ [^ ]/g,o=0,a=0,l=0,c="";n=r.exec(e);)(l=n.index)-o>t&&(i=a>o?a:l,c+="\n"+e.slice(o,i),o=i+1),a=l;return c+="\n",e.length-o>t&&a>o?c+=e.slice(o,a)+"\n"+e.slice(a+1):c+=e.slice(o),c.slice(1)}function $e(e,t,n,i){var r,o,a,l="",c=e.tag;for(r=0,o=n.length;r<o;r+=1)a=n[r],e.replacer&&(a=e.replacer.call(n,String(r),a)),(Ve(e,t+1,a,!0,!0,!1,!0)||void 0===a&&Ve(e,t+1,null,!0,!0,!1,!0))&&(i&&""===l||(l+=Le(e,t)),e.dump&&10===e.dump.charCodeAt(0)?l+="-":l+="- ",l+=e.dump);e.tag=c,e.dump=l||"[]"}function Ge(e,t,n){var i,r,a,l,c,s;for(a=0,l=(r=n?e.explicitTypes:e.implicitTypes).length;a<l;a+=1)if(((c=r[a]).instanceOf||c.predicate)&&(!c.instanceOf||"object"==typeof t&&t instanceof c.instanceOf)&&(!c.predicate||c.predicate(t))){if(n?c.multi&&c.representName?e.tag=c.representName(t):e.tag=c.tag:e.tag="?",c.represent){if(s=e.styleMap[c.tag]||c.defaultStyle,"[object Function]"===Ie.call(c.represent))i=c.represent(t,s);else{if(!Se.call(c.represent,s))throw new o("!<"+c.tag+'> tag resolver accepts not "'+s+'" style');i=c.represent[s](t,s)}e.dump=i}return!0}return!1}function Ve(e,t,n,i,r,a,l){e.tag=null,e.dump=n,Ge(e,n,!1)||Ge(e,n,!0);var c,s=Ie.call(e.dump),u=i;i&&(i=e.flowLevel<0||e.flowLevel>t);var p,f,d="[object Object]"===s||"[object Array]"===s;if(d&&(f=-1!==(p=e.duplicates.indexOf(n))),(null!==e.tag&&"?"!==e.tag||f||2!==e.indent&&t>0)&&(r=!1),f&&e.usedDuplicates[p])e.dump="*ref_"+p;else{if(d&&f&&!e.usedDuplicates[p]&&(e.usedDuplicates[p]=!0),"[object Object]"===s)i&&0!==Object.keys(e.dump).length?(!function(e,t,n,i){var r,a,l,c,s,u,p="",f=e.tag,d=Object.keys(n);if(!0===e.sortKeys)d.sort();else if("function"==typeof e.sortKeys)d.sort(e.sortKeys);else if(e.sortKeys)throw new o("sortKeys must be a boolean or a function");for(r=0,a=d.length;r<a;r+=1)u="",i&&""===p||(u+=Le(e,t)),c=n[l=d[r]],e.replacer&&(c=e.replacer.call(n,l,c)),Ve(e,t+1,l,!0,!0,!0)&&((s=null!==e.tag&&"?"!==e.tag||e.dump&&e.dump.length>1024)&&(e.dump&&10===e.dump.charCodeAt(0)?u+="?":u+="? "),u+=e.dump,s&&(u+=Le(e,t)),Ve(e,t+1,c,!0,s)&&(e.dump&&10===e.dump.charCodeAt(0)?u+=":":u+=": ",p+=u+=e.dump));e.tag=f,e.dump=p||"{}"}(e,t,e.dump,r),f&&(e.dump="&ref_"+p+e.dump)):(!function(e,t,n){var i,r,o,a,l,c="",s=e.tag,u=Object.keys(n);for(i=0,r=u.length;i<r;i+=1)l="",""!==c&&(l+=", "),e.condenseFlow&&(l+='"'),a=n[o=u[i]],e.replacer&&(a=e.replacer.call(n,o,a)),Ve(e,t,o,!1,!1)&&(e.dump.length>1024&&(l+="? "),l+=e.dump+(e.condenseFlow?'"':"")+":"+(e.condenseFlow?"":" "),Ve(e,t,a,!1,!1)&&(c+=l+=e.dump));e.tag=s,e.dump="{"+c+"}"}(e,t,e.dump),f&&(e.dump="&ref_"+p+" "+e.dump));else if("[object Array]"===s)i&&0!==e.dump.length?(e.noArrayIndent&&!l&&t>0?$e(e,t-1,e.dump,r):$e(e,t,e.dump,r),f&&(e.dump="&ref_"+p+e.dump)):(!function(e,t,n){var i,r,o,a="",l=e.tag;for(i=0,r=n.length;i<r;i+=1)o=n[i],e.replacer&&(o=e.replacer.call(n,String(i),o)),(Ve(e,t,o,!1,!1)||void 0===o&&Ve(e,t,null,!1,!1))&&(""!==a&&(a+=","+(e.condenseFlow?"":" ")),a+=e.dump);e.tag=l,e.dump="["+a+"]"}(e,t,e.dump),f&&(e.dump="&ref_"+p+" "+e.dump));else{if("[object String]"!==s){if("[object Undefined]"===s)return!1;if(e.skipInvalid)return!1;throw new o("unacceptable kind of an object to dump "+s)}"?"!==e.tag&&Ke(e,e.dump,t,a,u)}null!==e.tag&&"?"!==e.tag&&(c=encodeURI("!"===e.tag[0]?e.tag.slice(1):e.tag).replace(/!/g,"%21"),c="!"===e.tag[0]?"!"+c:"tag:yaml.org,2002:"===c.slice(0,18)?"!!"+c.slice(18):"!<"+c+">",e.dump=c+" "+e.dump)}return!0}function Ze(e,t){var n,i,r=[],o=[];for(Je(e,r,o),n=0,i=o.length;n<i;n+=1)t.duplicates.push(r[o[n]]);t.usedDuplicates=new Array(i)}function Je(e,t,n){var i,r,o;if(null!==e&&"object"==typeof e)if(-1!==(r=t.indexOf(e)))-1===n.indexOf(r)&&n.push(r);else if(t.push(e),Array.isArray(e))for(r=0,o=e.length;r<o;r+=1)Je(e[r],t,n);else for(r=0,o=(i=Object.keys(e)).length;r<o;r+=1)Je(e[i[r]],t,n)}function Qe(e,t){return function(){throw new Error("Function yaml."+e+" is removed in js-yaml 4. Use yaml."+t+" instead, which is now safe by default.")}}var ze=p,Xe=h,et=b,tt=O,nt=j,it=K,rt=xe.load,ot=xe.loadAll,at={dump:function(e,t){var n=new Ee(t=t||{});n.noRefs||Ze(e,n);var i=e;return n.replacer&&(i=n.replacer.call({"":i},"",i)),Ve(n,0,i,!0,!0)?n.dump+"\n":""}}.dump,lt=o,ct={binary:L,float:S,map:y,null:A,pairs:Y,set:B,timestamp:F,bool:v,int:C,merge:E,omap:U,seq:m,str:g},st=Qe("safeLoad","load"),ut=Qe("safeLoadAll","loadAll"),pt=Qe("safeDump","dump"),ft={Type:ze,Schema:Xe,FAILSAFE_SCHEMA:et,JSON_SCHEMA:tt,CORE_SCHEMA:nt,DEFAULT_SCHEMA:it,load:rt,loadAll:ot,dump:at,YAMLException:lt,types:ct,safeLoad:st,safeLoadAll:ut,safeDump:pt};e.CORE_SCHEMA=nt,e.DEFAULT_SCHEMA=it,e.FAILSAFE_SCHEMA=et,e.JSON_SCHEMA=tt,e.Schema=Xe,e.Type=ze,e.YAMLException=lt,e.default=ft,e.dump=at,e.load=rt,e.loadAll=ot,e.safeDump=pt,e.safeLoad=st,e.safeLoadAll=ut,e.types=ct,Object.defineProperty(e,"__esModule",{value:!0})}));
// --- END JS-YAML ---

const yaml = module.exports;

// ====== 工具函数 ======
function safeB64Decode(data) {
    data = data.trim();
    let padding = 4 - (data.length % 4);
    if (padding !== 4) data += "=".repeat(padding);
    data = data.replace(/-/g, '+').replace(/_/g, '/');
    try {
        const binString = atob(data);
        const bytes = new Uint8Array(binString.length);
        for (let i = 0; i < binString.length; i++) {
            bytes[i] = binString.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
    } catch (e) {
        return null;
    }
}

function parseBool(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    return String(value).toLowerCase() === "true" || String(value) === "1" || String(value).toLowerCase() === "yes";
}

function getParam(params, key, defaultVal = "") {
    return params.has(key) ? params.get(key) : defaultVal;
}

function setIfPresent(node, key, value) {
    if (value !== null && value !== undefined && value !== "") {
        node[key] = value;
    }
}

// ====== 解析器 ======

function parseSs(uri) {
    let content = uri.slice(5);
    let name = "";
    if (content.includes("#")) {
        const hashIdx = content.lastIndexOf("#");
        name = decodeURIComponent(content.slice(hashIdx + 1)).trim();
        content = content.slice(0, hashIdx);
    }
    
    if (!content.includes("@")) {
        const decoded = safeB64Decode(content);
        if (decoded && decoded.includes("@")) {
            content = decoded;
        }
    }
    
    if (content.includes("#") && !name) {
        const hashIdx = content.lastIndexOf("#");
        name = decodeURIComponent(content.slice(hashIdx + 1)).trim();
        content = content.slice(0, hashIdx);
    }
    
    if (!content.includes("@")) return null;
    
    const atIdx = content.lastIndexOf("@");
    let userinfo = content.slice(0, atIdx);
    let serverPart = content.slice(atIdx + 1);
    
    let queryStr = "";
    if (serverPart.includes("?")) {
        const qIdx = serverPart.indexOf("?");
        queryStr = serverPart.slice(qIdx + 1);
        serverPart = serverPart.slice(0, qIdx);
    }
    
    if (!serverPart.includes(":")) return null;
    const colonIdx = serverPart.lastIndexOf(":");
    const host = serverPart.slice(0, colonIdx);
    const portStr = serverPart.slice(colonIdx + 1);
    
    const decodedUserinfo = safeB64Decode(userinfo);
    if (decodedUserinfo && decodedUserinfo.includes(":")) {
        userinfo = decodedUserinfo;
    }
    
    if (!userinfo.includes(":")) return null;
    const pwdColonIdx = userinfo.indexOf(":");
    const method = userinfo.slice(0, pwdColonIdx);
    const password = userinfo.slice(pwdColonIdx + 1);
    
    let node = {
        name: name || `${host}:${portStr}`,
        type: "ss",
        server: host,
        port: parseInt(portStr),
        cipher: method,
        password: password
    };
    
    if (queryStr) {
        const params = new URLSearchParams(queryStr);
        if (params.has("plugin")) {
            const pluginRaw = params.get("plugin");
            const parts = pluginRaw.split(";");
            const pluginName = parts[0];
            const pluginMap = {
                "obfs-local": "obfs",
                "simple-obfs": "obfs",
                "v2ray-plugin": "v2ray-plugin"
            };
            node.plugin = pluginMap[pluginName] || pluginName;
            
            const pluginOpts = {};
            for (let i = 1; i < parts.length; i++) {
                if (parts[i].includes("=")) {
                    const [k, v] = parts[i].split("=");
                    pluginOpts[k] = v;
                }
            }
            if (Object.keys(pluginOpts).length > 0) {
                const mappedOpts = {};
                for (const [k, v] of Object.entries(pluginOpts)) {
                    if (k === "obfs") mappedOpts["mode"] = v;
                    else if (k === "obfs-host") mappedOpts["host"] = v;
                    else mappedOpts[k] = v;
                }
                node["plugin-opts"] = mappedOpts;
            }
        }
        if (params.has("udp")) {
            node["udp"] = parseBool(params.get("udp"));
        }
    }
    return node;
}

function parseVmess(uri) {
    const content = uri.slice(8);
    const decoded = safeB64Decode(content);
    if (!decoded) return null;
    
    let data;
    try {
        data = JSON.parse(decoded);
    } catch (e) {
        return null;
    }
    
    let node = {
        name: String(data.ps || ""),
        type: "vmess",
        server: String(data.add || ""),
        port: parseInt(data.port || 0),
        uuid: String(data.id || ""),
        alterId: parseInt(data.aid || 0),
        cipher: String(data.scy || "auto")
    };
    
    if (data.net) node.network = data.net;
    
    const tlsVal = data.tls || "";
    if (tlsVal && tlsVal !== "none" && tlsVal !== "") node.tls = true;
    
    setIfPresent(node, "sni", data.sni);
    setIfPresent(node, "client-fingerprint", data.fp);
    setIfPresent(node, "servername", data.sni);
    
    const net = data.net;
    if (net === "ws") {
        let wsOpts = {};
        setIfPresent(wsOpts, "path", data.path);
        let host = data.host || "";
        if (host) wsOpts.headers = {"Host": host};
        if (Object.keys(wsOpts).length > 0) node["ws-opts"] = wsOpts;
    } else if (net === "h2") {
        let h2Opts = {};
        setIfPresent(h2Opts, "path", data.path);
        let host = data.host || "";
        if (host) h2Opts.host = [host];
        if (Object.keys(h2Opts).length > 0) node["h2-opts"] = h2Opts;
    } else if (net === "grpc") {
        let grpcOpts = {};
        setIfPresent(grpcOpts, "grpc-service-name", data.path);
        if (Object.keys(grpcOpts).length > 0) node["grpc-opts"] = grpcOpts;
    } else if (net === "http") {
        let httpOpts = {};
        let path = data.path || "";
        if (path) httpOpts.path = [path];
        let host = data.host || "";
        if (host) httpOpts.headers = {"Host": [host]};
        if (Object.keys(httpOpts).length > 0) node["http-opts"] = httpOpts;
    }
    
    setIfPresent(node, "packet-encoding", data.packetEncoding);
    return node;
}

function parseTransportOpts(node, params) {
    const transport = getParam(params, "type", "tcp");
    if (transport && transport !== "tcp") node.network = transport;
    
    if (transport === "ws") {
        let wsOpts = {};
        setIfPresent(wsOpts, "path", decodeURIComponent(getParam(params, "path")));
        const host = getParam(params, "host");
        if (host) wsOpts.headers = {"Host": decodeURIComponent(host)};
        if (Object.keys(wsOpts).length > 0) node["ws-opts"] = wsOpts;
    } else if (transport === "grpc") {
        let grpcOpts = {};
        setIfPresent(grpcOpts, "grpc-service-name", decodeURIComponent(getParam(params, "serviceName")));
        if (Object.keys(grpcOpts).length > 0) node["grpc-opts"] = grpcOpts;
    } else if (transport === "h2") {
        let h2Opts = {};
        setIfPresent(h2Opts, "path", decodeURIComponent(getParam(params, "path")));
        const host = getParam(params, "host");
        if (host) h2Opts.host = [decodeURIComponent(host)];
        if (Object.keys(h2Opts).length > 0) node["h2-opts"] = h2Opts;
    } else if (transport === "http") {
        let httpOpts = {};
        const path = getParam(params, "path");
        if (path) httpOpts.path = [decodeURIComponent(path)];
        const host = getParam(params, "host");
        if (host) httpOpts.headers = {"Host": [decodeURIComponent(host)]};
        if (Object.keys(httpOpts).length > 0) node["http-opts"] = httpOpts;
    }
}

function parseTlsOpts(node, params) {
    const security = getParam(params, "security");
    if (security === "tls") node.tls = true;
    else if (security === "reality") {
        node.tls = true;
        let realityOpts = {};
        setIfPresent(realityOpts, "public-key", getParam(params, "pbk"));
        setIfPresent(realityOpts, "short-id", getParam(params, "sid"));
        if (Object.keys(realityOpts).length > 0) node["reality-opts"] = realityOpts;
    }
    
    setIfPresent(node, "sni", getParam(params, "sni"));
    setIfPresent(node, "client-fingerprint", getParam(params, "fp"));
    
    const insecure = getParam(params, "allowInsecure") || getParam(params, "insecure");
    if (insecure) node["skip-cert-verify"] = parseBool(insecure);
    
    const alpn = getParam(params, "alpn");
    if (alpn) node.alpn = decodeURIComponent(alpn).split(",");
}

function parseVless(uri) {
    let parsed;
    try { parsed = new URL(uri); } catch(e) { return null; }
    if (!parsed.hostname || !parsed.port) return null;
    
    const name = parsed.hash ? decodeURIComponent(parsed.hash.slice(1)).trim() : `${parsed.hostname}:${parsed.port}`;
    const params = parsed.searchParams;
    
    let node = {
        name: name,
        type: "vless",
        server: parsed.hostname,
        port: parseInt(parsed.port),
        uuid: parsed.username || ""
    };
    
    setIfPresent(node, "flow", getParam(params, "flow"));
    parseTransportOpts(node, params);
    parseTlsOpts(node, params);
    return node;
}

function parseTrojan(uri) {
    let parsed;
    try { parsed = new URL(uri); } catch(e) { return null; }
    if (!parsed.hostname || !parsed.port) return null;
    
    const name = parsed.hash ? decodeURIComponent(parsed.hash.slice(1)).trim() : `${parsed.hostname}:${parsed.port}`;
    const params = parsed.searchParams;
    
    let node = {
        name: name,
        type: "trojan",
        server: parsed.hostname,
        port: parseInt(parsed.port),
        password: parsed.username ? decodeURIComponent(parsed.username) : ""
    };
    
    setIfPresent(node, "sni", getParam(params, "sni"));
    setIfPresent(node, "client-fingerprint", getParam(params, "fp"));
    const insecure = getParam(params, "allowInsecure") || getParam(params, "insecure");
    if (insecure) node["skip-cert-verify"] = parseBool(insecure);
    const alpn = getParam(params, "alpn");
    if (alpn) node.alpn = decodeURIComponent(alpn).split(",");
    
    parseTransportOpts(node, params);
    
    const udp = getParam(params, "udp");
    if (udp) node.udp = parseBool(udp);
    return node;
}

function parseHysteria(uri) {
    let parsed;
    try { parsed = new URL(uri); } catch(e) { return null; }
    if (!parsed.hostname || !parsed.port) return null;
    
    const name = parsed.hash ? decodeURIComponent(parsed.hash.slice(1)).trim() : `${parsed.hostname}:${parsed.port}`;
    const params = parsed.searchParams;
    
    let node = {
        name: name,
        type: "hysteria",
        server: parsed.hostname,
        port: parseInt(parsed.port)
    };
    
    const parsedUser = parsed.username ? decodeURIComponent(parsed.username) : "";
    setIfPresent(node, "auth-str", getParam(params, "auth", parsedUser));
    setIfPresent(node, "protocol", getParam(params, "protocol"));
    
    const up = getParam(params, "upmbps");
    if (up) node.up = `${up} Mbps`;
    
    const down = getParam(params, "downmbps");
    if (down) node.down = `${down} Mbps`;
    
    const obfs = getParam(params, "obfs");
    setIfPresent(node, "obfs", obfs);
    const obfsParam = getParam(params, "obfsParam");
    if (obfsParam && !obfs) node.obfs = obfsParam;
    
    setIfPresent(node, "sni", getParam(params, "sni") || getParam(params, "peer"));
    const insecure = getParam(params, "insecure");
    if (insecure) node["skip-cert-verify"] = parseBool(insecure);
    const alpn = getParam(params, "alpn");
    if (alpn) node.alpn = decodeURIComponent(alpn).split(",");
    
    return node;
}

function parseHysteria2(uri) {
    let parsed;
    try { parsed = new URL(uri); } catch(e) { return null; }
    if (!parsed.hostname || !parsed.port) return null;
    
    const name = parsed.hash ? decodeURIComponent(parsed.hash.slice(1)).trim() : `${parsed.hostname}:${parsed.port}`;
    const params = parsed.searchParams;
    
    let node = {
        name: name,
        type: "hysteria2",
        server: parsed.hostname,
        port: parseInt(parsed.port)
    };
    
    setIfPresent(node, "password", parsed.username ? decodeURIComponent(parsed.username) : "");
    setIfPresent(node, "obfs", getParam(params, "obfs"));
    setIfPresent(node, "obfs-password", getParam(params, "obfs-password"));
    setIfPresent(node, "sni", getParam(params, "sni"));
    
    const insecure = getParam(params, "insecure");
    if (insecure) node["skip-cert-verify"] = parseBool(insecure);
    
    return node;
}

const SCHEME_MAP = {
    "ss": "ss",
    "vmess": "vmess",
    "vless": "vless",
    "trojan": "trojan",
    "hysteria": "hysteria",
    "hysteria2": "hysteria2",
    "hy2": "hysteria2"
};

const URI_PARSERS = {
    "ss": parseSs,
    "vmess": parseVmess,
    "vless": parseVless,
    "trojan": parseTrojan,
    "hysteria": parseHysteria,
    "hysteria2": parseHysteria2,
    "hy2": parseHysteria2
};

function parseUriLine(line) {
    line = line.trim();
    if (!line) return null;
    for (const scheme in SCHEME_MAP) {
        if (line.startsWith(`${scheme}://`)) {
            const parser = URI_PARSERS[scheme];
            if (parser) return parser(line);
            break;
        }
    }
    return null;
}

function detectAndParse(content, depth = 0) {
    if (depth > 5) return [];
    content = content.trim();
    if (!content) return [];
    
    if (content.includes("proxies:")) {
        return parseYamlContent(content);
    }
    
    const lines = content.split('\n');
    const nonEmpty = lines.map(ln => ln.trim()).filter(ln => ln && !ln.startsWith("#"));
    
    if (nonEmpty.length > 0) {
        const uriLines = nonEmpty.filter(ln => {
            for (const scheme in SCHEME_MAP) {
                if (ln.startsWith(`${scheme}://`)) return true;
            }
            return false;
        });
        if (uriLines.length > 0 && (uriLines.length / nonEmpty.length > 0.5)) {
            return parseUriList(nonEmpty);
        }
    }
    
    let b64Content = "";
    for (const line of lines) {
        const stripped = line.trim();
        if (stripped && !stripped.startsWith("#")) {
            b64Content += stripped;
        }
    }
    
    const decoded = safeB64Decode(b64Content);
    if (decoded) {
        return detectAndParse(decoded, depth + 1);
    }
    
    return [];
}

function parseYamlContent(content) {
    try {
        const data = yaml.load(content);
        if (typeof data !== 'object' || data === null) return [];
        const proxies = data.proxies || [];
        if (!Array.isArray(proxies)) return [];
        return proxies;
    } catch (e) {
        return [];
    }
}

function parseUriList(lines) {
    const nodes = [];
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith("#")) continue;
        const node = parseUriLine(line);
        if (node) nodes.push(node);
    }
    return nodes;
}

const ALLOWED_TYPES = new Set(["ss", "vmess", "vless", "trojan", "hysteria", "hysteria2"]);

function cleanNode(node) {
    let cleaned = {};
    for (let [key, value] of Object.entries(node)) {
        if (value === null || value === undefined) continue;
        if (typeof value === "object" && !Array.isArray(value)) {
            let inner = cleanNode(value);
            if (Object.keys(inner).length > 0) {
                cleaned[key] = inner;
            }
        } else {
            cleaned[key] = value;
        }
    }
    return cleaned;
}

function filterNodes(nodes) {
    let filtered = [];
    for (const node of nodes) {
        const type = node.type || "unknown";
        if (ALLOWED_TYPES.has(type)) {
            filtered.push(cleanNode(node));
        }
    }
    return filtered;
}


function toLooseJSON(obj) {
    if (typeof obj !== 'object' || obj === null) {
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
}

/**
 * 带超时和 User-Agent 的 fetch
 */
async function fetchSubscriptionContent(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'mihomo/1.19.16 ClashMeta'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.text();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('获取订阅内容超时');
    }
    throw new Error(`获取订阅失败: ${err.message}`);
  }
}

/**
 * 内建解析逻辑处理订阅链接
 */
async function processSubscription(url, subName) {
  let content;
  try {
    content = await fetchSubscriptionContent(url);
  } catch (err) {
    throw err;
  }
  
  if (!content || !content.trim()) {
    throw new Error('订阅内容为空');
  }
  
  // 使用内建的解析逻辑 (来自 resolver.js 功能)
  const nodes = detectAndParse(content, 0);
  const filteredNodes = filterNodes(nodes);
  
  if (filteredNodes.length === 0) {
    const preview = content.trim().substring(0, 100).replace(/\n/g, '\\n');
    throw new Error(`未解析到有效节点\n原始内容前100字符: ${preview}`);
  }
  
  if (subName) {
    filteredNodes.forEach(node => {
      if (node.name) {
        node.name = subName + ' ' + node.name;
      }
    });
  }
  
  // 转换为松散 JSON 格式供合并使用
  const formattedNodes = filteredNodes.map(node => toLooseJSON(node));
  
  return {
    format: 'Integrated Resolver',
    nodeCount: formattedNodes.length,
    content: formattedNodes.join('\n'),
  };
}

// ========================================
// Cloudflare Worker 主入口
// ========================================

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
        
        // PARSE 端点（手动模式解析节点）- 需要在通用验证之前处理
        if (path === '/api/sub/parse') {
            if (body.index < 0 || body.index >= subs.length) {
                return err('订阅不存在');
            }
            
            const sub = subs[body.index];
            
            try {
                // 调用解析函数
                const result = await processSubscription(sub.url, sub.name);
                
                // 保存节点内容到 KV
                const nodeKey = `node_sub_${sub.name}`;
                await env.SUBPANEL_KV.put(nodeKey, result.content);
                
                // 更新订阅的最后更新时间
                const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
                subs[body.index].lastUpdate = now;
                await putJSON('SUBS', subs);
                
                return ok({
                    success: true,
                    lastUpdate: now,
                    nodeCount: result.nodeCount,
                    subs
                });
            } catch (error) {
                return err(error.message);
            }
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
            subs.push({ 
                name: body.name, 
                url: body.url,
                useProvider: body.useProvider !== undefined ? body.useProvider : true,  // 默认启用 provider
                autoUpdate: false, // 默认不自动更新
                lastUpdate: null 
            });
        } else if (path === '/api/sub/update') {
            // 保留原有数据，仅更新提供的字段
            subs[body.index] = { 
                ...subs[body.index],
                name: body.name, 
                url: body.url,
                useProvider: body.useProvider !== undefined ? body.useProvider : subs[body.index].useProvider,
                autoUpdate: body.autoUpdate !== undefined ? body.autoUpdate : subs[body.index].autoUpdate
            };
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

        // 2. Process Subs (分别处理 Provider 和手动模式)
        let proxyProvidersBlock = '';  // Provider 模式的订阅
        let subProxiesLines = [];      // 手动模式的节点
        
        if (sub_names && sub_names.length > 0) {
            const selectedSubs = subs.filter(s => sub_names.includes(s.name));
            
            for (const sub of selectedSubs) {
                if (sub.useProvider) {
                    // Provider 模式：添加到 proxy-providers
                    if (!proxyProvidersBlock) {
                        proxyProvidersBlock = 'proxy-providers:\n';
                    }
                    let intervalValue = sub.autoUpdate ? 3600 : 0;
                    let item = SUBSCRIBE_TEMPLATE_ITEM
                        。replace(/{name}/g, sub.name)
                        。replace(/{url}/g, sub.url)
                        。replace(/{interval}/g, intervalValue);
                    proxyProvidersBlock += item + '\n';
                } else {
                    // 手动模式：从 KV 读取节点，添加到 proxies
                    const nodeKey = `node_sub_${sub.name}`;
                    const nodeContent = await env.SUBPANEL_KV.get(nodeKey);
                    if (nodeContent) {
                        // 每个节点需要添加 '- ' 前缀（YAML 列表格式）
                        const lines = nodeContent.split('\n').filter(l => l.trim());
                        for (const line of lines) {
                            subProxiesLines.push('  - ' + line);
                        }
                    }
                }
            }
        }

        // 3. Process Nodes (Proxies - 手动添加的节点)
        let manualProxiesLines = [];
        if (node_names && node_names.length > 0) {
            const selectedNodes = nodes.filter(n => node_names.includes(n.name));
            for (const node of selectedNodes) {
                manualProxiesLines.push(`  - ${node.content}`);
            }
        }
        
        // 合并所有 proxies (手动模式订阅 + 手动添加的节点)
        let proxiesBlock = '';
        const allProxies = [...subProxiesLines, ...manualProxiesLines];
        if (allProxies.length > 0) {
            proxiesBlock = 'proxies:\n' + allProxies.join('\n') + '\n';
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
