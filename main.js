const DEBUG = false;

const DEBUG_PANEL_STYLE = `
        #diag-panel {
            position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
            background: #7f1d1d; color: #fff; font: 12px/1.5 monospace;
            padding: 10px 14px; max-height: 50vh; overflow: auto; white-space: pre-wrap;
        }
        #diag-panel.hidden { display: none !important; }
        #diag-panel .diag-title { font-weight: bold; margin-bottom: 6px; }
        #diag-panel .diag-item { border-top: 1px solid rgba(255,255,255,.2); padding-top: 4px; margin-top: 4px; }`;

const DEBUG_PANEL_SCRIPT = `
        (function () {
            window.__diagLogs = [];
            function esc(s) {
                return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
            function renderDiag() {
                var panel = document.getElementById('diag-panel');
                if (!panel) return;
                if (window.__diagLogs.length === 0) { panel.classList.add('hidden'); return; }
                panel.classList.remove('hidden');
                panel.innerHTML = '<div class="diag-title">DIAG 页面运行时错误</div>' +
                    window.__diagLogs.map(function (m) { return '<div class="diag-item">' + m + '</div>'; }).join('');
            }
            window.__diag = function (msg) { window.__diagLogs.push(esc(msg)); renderDiag(); };
            window.addEventListener('error', function (e) {
                if (e.target && (e.target.tagName === 'SCRIPT' || e.target.tagName === 'LINK')) {
                    window.__diag('资源加载失败: ' + (e.target.src || e.target.href));
                } else {
                    window.__diag('JS错误: ' + (e.message || e.error) +
                        (e.filename ? ' @ ' + e.filename + ':' + e.lineno + ':' + e.colno : ''));
                }
            }, true);
            window.addEventListener('unhandledrejection', function (e) {
                var r = e.reason;
                window.__diag('Promise拒绝: ' + (r && r.message ? r.message : r));
            });
            window.addEventListener('DOMContentLoaded', function () {
                setTimeout(function () {
                    if (window.Alpine) return;
                    var warning = document.getElementById('runtime-warning');
                    if (warning) warning.classList.remove('hidden');
                    window.__diag('Alpine.js 未启动：检查 /assets/alpine.min.js 是否返回 200 且为合法 JS。');
                }, 1500);
            });
        })();`;

const DEBUG_PANEL_BODY = `
    <div id="diag-panel" class="hidden"></div>`;

// ====== KV 键名 ======
const KV_KEY_SUBS = 'SUBS';
const KV_KEY_NODES = 'NODES';
const KV_KEY_TEMPLATES = 'TEMPLATES';
// 旧版内置默认模板（已移除，仅用于一次性迁移）
const KV_KEY_LEGACY_DEFAULT_TEMPLATE = 'template0';
const KV_KEY_LEGACY_DEFAULT_TEMPLATE_META = 'template0_meta';
const KV_KEY_RULE_APPEND = 'RULE_APPEND_CONFIG';
const KV_KEY_HOSTS_APPEND = 'HOSTS_APPEND_CONFIG';
const KV_KEY_OUTPUT_CONFIGS = 'OUTPUT_CONFIGS';
const KV_KEY_CONFIG_TOKEN = 'CONFIG_TOKEN';
const KV_KEY_ADMIN_PASSWORD = 'ADMIN_PASSWORD';
const KV_KEY_LEGACY_CONFIG = 'myconfig';
const KV_KEY_LOGIN_GUARD = 'LOGIN_GUARD';

const OUTPUT_CONFIG_CONTENT_PREFIX = 'myconfig_';
const SUBSCRIPTION_CACHE_PREFIX = 'node_sub_';

// ====== 数量与容量上限 ======
const MAX_SUBS = 5;
const MAX_NODES = 5;
const MAX_TEMPLATES = 5;
const MAX_OUTPUT_CONFIGS = 5;
const MAX_HOSTS_SUBS = 5;
// 单个 Hosts 订阅源、静态 Hosts 各自的条数上限（按去重后的域名计）
const MAX_HOSTS_ENTRIES = 300;

const MAX_SUBSCRIPTION_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_SUBSCRIPTION_OUTPUT_BYTES = 4 * 1024 * 1024;
const MAX_SUBSCRIPTION_NODES = 5000;
const MAX_NODE_DEPTH = 32;
const MAX_RULE_ITEMS = 500;
const SUBSCRIPTION_FILE_PATTERN = /\.(?:ya?ml|txt)$/i;

// ====== 规则定义 ======
// 规则类型白名单：包含 Mihomo 常用类型。
// 不含 MATCH：附加规则插在 rules 顶部，MATCH 会让模板后续规则全部失效。
const RULE_TYPES = [
    'DOMAIN',
    'DOMAIN-SUFFIX',
    'DOMAIN-KEYWORD',
    'DOMAIN-REGEX',
    'GEOSITE',
    'IP-CIDR',
    'IP-CIDR6',
    'IP-SUFFIX',
    'GEOIP',
    'SRC-GEOIP',
    'DST-PORT',
    'SRC-PORT',
    'PROCESS-NAME',
    'PROCESS-PATH',
    'RULE-SET'
];
// 内置策略：不需要模板中存在同名策略组也能直接使用。
const RULE_BUILTIN_POLICIES = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE', 'NULL'];
// 支持 no-resolve 修饰的规则类型。
const RULE_NO_RESOLVE_TYPES = new Set(['IP-CIDR', 'IPCIDR', 'IP-CIDR6', 'IP-SUFFIX', 'GEOIP', 'SRC-GEOIP']);
// 规则作用目标：全局代表所有模板生效。
const RULE_TARGET_GLOBAL = 'global';
// 暂不启用该条规则的占位策略。
const RULE_DISABLED_POLICY = 'NULL';

// ====== Hosts 定义 ======
const HOSTS_IP_FILTERS = ['all', 'ipv4', 'ipv6'];
const HOSTS_AUTO_UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const HOSTS_AUTO_UPDATE_RETRY_COOLDOWN_MS = 15 * 60 * 1000;

// ====== 会话与安全 ======
const SESSION_COOKIE_NAME = 'subpanel_session';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const LOGIN_FAIL_LIMIT = 5;
const LOGIN_FAIL_WINDOW_MS = 10 * 60 * 1000;
const MIN_ADMIN_PASSWORD_LENGTH = 6;

// ====== 模板标识 ======
// 模板 ID 统一以 tpl_ 开头。旧数据无 ID 时按名称派生确定性 ID（迁移稳定）。
const TEMPLATE_ID_PREFIX = 'tpl_';
// 旧版内置默认模板的引用值，以及迁移后转成的普通模板
const LEGACY_DEFAULT_TEMPLATE_ID = 'template0';
const MIGRATED_DEFAULT_TEMPLATE_ID = 'tpl_default_migrated';
const MIGRATED_DEFAULT_TEMPLATE_NAME = '默认模板（迁移）';
// 规则 ID 允许的字符（客户端可预生成 ID，便于暂存后统一保存）
const RULE_ID_PATTERN = /^[A-Za-z0-9_-]{1,48}$/;

// ====== 运行时前端资源（边缘 Cache API 缓存） ======
const RUNTIME_ASSETS = {
    '/assets/alpine.min.js': {
        urls: [
            'https://registry.npmmirror.com/alpinejs/3.14.8/files/dist/cdn.min.js',
            'https://cdn.jsdelivr.net/npm/alpinejs@3.14.8/dist/cdn.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/alpinejs/3.14.8/cdn.min.js',
            'https://unpkg.com/alpinejs@3.14.8/dist/cdn.min.js'
        ],
        contentType: 'application/javascript;charset=UTF-8'
    }
};

// ====== [MODULE: 02_jsyaml.js] ======
// ============================================================================
// 内嵌 js-yaml 4.1.0（MIT）
// 说明：去掉 module/exports 包装后直接暴露 const yaml。
// ============================================================================
const module = { exports: {} };
const exports = module.exports;

// --- BEGIN JS-YAML (v4.1.0) ---
/*! js-yaml 4.1.0 https://github.com/nodeca/js-yaml @license MIT */

void function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):t((e="undefined"!=typeof globalThis?globalThis:e||self).jsyaml={})}(this,(function(e){"use strict";function t(e){return null==e}var n={isNothing:t,isObject:function(e){return"object"==typeof e&&null!==e},toArray:function(e){return Array.isArray(e)?e:t(e)?[]:[e]},repeat:function(e,t){var n,i="";for(n=0;n<t;n+=1)i+=e;return i},isNegativeZero:function(e){return 0===e&&Number.NEGATIVE_INFINITY===1/e},extend:function(e,t){var n,i,r,o;if(t)for(n=0,i=(o=Object.keys(t)).length;n<i;n+=1)e[r=o[n]]=t[r];return e}};function i(e,t){var n="",i=e.reason||"(unknown reason)";return e.mark?(e.mark.name&&(n+='in "'+e.mark.name+'" '),n+="("+(e.mark.line+1)+":"+(e.mark.column+1)+")",!t&&e.mark.snippet&&(n+="\n\n"+e.mark.snippet),i+" "+n):i}function r(e,t){Error.call(this),this.name="YAMLException",this.reason=e,this.mark=t,this.message=i(this,!1),Error.captureStackTrace?Error.captureStackTrace(this,this.constructor):this.stack=(new Error).stack||""}r.prototype=Object.create(Error.prototype),r.prototype.constructor=r,r.prototype.toString=function(e){return this.name+": "+i(this,e)};var o=r;function a(e,t,n,i,r){var o="",a="",l=Math.floor(r/2)-1;return i-t>l&&(t=i-l+(o=" ... ").length),n-i>l&&(n=i+l-(a=" ...").length),{str:o+e.slice(t,n).replace(/\t/g,"→")+a,pos:i-t+o.length}}function l(e,t){return n.repeat(" ",t-e.length)+e}var c=function(e,t){if(t=Object.create(t||null),!e.buffer)return null;t.maxLength||(t.maxLength=79),"number"!=typeof t.indent&&(t.indent=1),"number"!=typeof t.linesBefore&&(t.linesBefore=3),"number"!=typeof t.linesAfter&&(t.linesAfter=2);for(var i,r=/\r?\n|\r|\0/g,o=[0],c=[],s=-1;i=r.exec(e.buffer);)c.push(i.index),o.push(i.index+i[0].length),e.position<=i.index&&s<0&&(s=o.length-2);s<0&&(s=o.length-1);var u,p,f="",d=Math.min(e.line+t.linesAfter,c.length).toString().length,h=t.maxLength-(t.indent+d+3);for(u=1;u<=t.linesBefore&&!(s-u<0);u++)p=a(e.buffer,o[s-u],c[s-u],e.position-(o[s]-o[s-u]),h),f=n.repeat(" ",t.indent)+l((e.line-u+1).toString(),d)+" | "+p.str+"\n"+f;for(p=a(e.buffer,o[s],c[s],e.position,h),f+=n.repeat(" ",t.indent)+l((e.line+1).toString(),d)+" | "+p.str+"\n",f+=n.repeat("-",t.indent+d+3+p.pos)+"^\n",u=1;u<=t.linesAfter&&!(s+u>=c.length);u++)p=a(e.buffer,o[s+u],c[s+u],e.position-(o[s]-o[s+u]),h),f+=n.repeat(" ",t.indent)+l((e.line+u+1).toString(),d)+" | "+p.str+"\n";return f.replace(/\n$/,"")},s=["kind","multi","resolve","construct","instanceOf","predicate","represent","representName","defaultStyle","styleAliases"],u=["scalar","sequence","mapping"];var p=function(e,t){if(t=t||{},Object.keys(t).forEach((function(t){if(-1===s.indexOf(t))throw new o('Unknown option "'+t+'" is met in definition of "'+e+'" YAML type.')})),this.options=t,this.tag=e,this.kind=t.kind||null,this.resolve=t.resolve||function(){return!0},this.construct=t.construct||function(e){return e},this.instanceOf=t.instanceOf||null,this.predicate=t.predicate||null,this.represent=t.represent||null,this.representName=t.representName||null,this.defaultStyle=t.defaultStyle||null,this.multi=t.multi||!1,this.styleAliases=function(e){var t={};return null!==e&&Object.keys(e).forEach((function(n){e[n].forEach((function(e){t[String(e)]=n}))})),t}(t.styleAliases||null),-1===u.indexOf(this.kind))throw new o('Unknown kind "'+this.kind+'" is specified for "'+e+'" YAML type.')};function f(e,t){var n=[];return e[t].forEach((function(e){var t=n.length;n.forEach((function(n,i){n.tag===e.tag&&n.kind===e.kind&&n.multi===e.multi&&(t=i)})),n[t]=e})),n}function d(e){return this.extend(e)}d.prototype.extend=function(e){var t=[],n=[];if(e instanceof p)n.push(e);else if(Array.isArray(e))n=n.concat(e);else{if(!e||!Array.isArray(e.implicit)&&!Array.isArray(e.explicit))throw new o("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");e.implicit&&(t=t.concat(e.implicit)),e.explicit&&(n=n.concat(e.explicit))}t.forEach((function(e){if(!(e instanceof p))throw new o("Specified list of YAML types (or a single Type object) contains a non-Type object.");if(e.loadKind&&"scalar"!==e.loadKind)throw new o("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");if(e.multi)throw new o("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.")})),n.forEach((function(e){if(!(e instanceof p))throw new o("Specified list of YAML types (or a single Type object) contains a non-Type object.")}));var i=Object.create(d.prototype);return i.implicit=(this.implicit||[]).concat(t),i.explicit=(this.explicit||[]).concat(n),i.compiledImplicit=f(i,"implicit"),i.compiledExplicit=f(i,"explicit"),i.compiledTypeMap=function(){var e,t,n={scalar:{},sequence:{},mapping:{},fallback:{},multi:{scalar:[],sequence:[],mapping:[],fallback:[]}};function i(e){e.multi?(n.multi[e.kind].push(e),n.multi.fallback.push(e)):n[e.kind][e.tag]=n.fallback[e.tag]=e}for(e=0,t=arguments.length;e<t;e+=1)arguments[e].forEach(i);return n}(i.compiledImplicit,i.compiledExplicit),i};var h=d,g=new p("tag:yaml.org,2002:str",{kind:"scalar",construct:function(e){return null!==e?e:""}}),m=new p("tag:yaml.org,2002:seq",{kind:"sequence",construct:function(e){return null!==e?e:[]}}),y=new p("tag:yaml.org,2002:map",{kind:"mapping",construct:function(e){return null!==e?e:{}}}),b=new h({explicit:[g,m,y]});var A=new p("tag:yaml.org,2002:null",{kind:"scalar",resolve:function(e){if(null===e)return!0;var t=e.length;return 1===t&&"~"===e||4===t&&("null"===e||"Null"===e||"NULL"===e)},construct:function(){return null},predicate:function(e){return null===e},represent:{canonical:function(){return"~"},lowercase:function(){return"null"},uppercase:function(){return"NULL"},camelcase:function(){return"Null"},empty:function(){return""}},defaultStyle:"lowercase"});var v=new p("tag:yaml.org,2002:bool",{kind:"scalar",resolve:function(e){if(null===e)return!1;var t=e.length;return 4===t&&("true"===e||"True"===e||"TRUE"===e)||5===t&&("false"===e||"False"===e||"FALSE"===e)},construct:function(e){return"true"===e||"True"===e||"TRUE"===e},predicate:function(e){return"[object Boolean]"===Object.prototype.toString.call(e)},represent:{lowercase:function(e){return e?"true":"false"},uppercase:function(e){return e?"TRUE":"FALSE"},camelcase:function(e){return e?"True":"False"}},defaultStyle:"lowercase"});function w(e){return 48<=e&&e<=55}function k(e){return 48<=e&&e<=57}var C=new p("tag:yaml.org,2002:int",{kind:"scalar",resolve:function(e){if(null===e)return!1;var t,n,i=e.length,r=0,o=!1;if(!i)return!1;if("-"!==(t=e[r])&&"+"!==t||(t=e[++r]),"0"===t){if(r+1===i)return!0;if("b"===(t=e[++r])){for(r++;r<i;r++)if("_"!==(t=e[r])){if("0"!==t&&"1"!==t)return!1;o=!0}return o&&"_"!==t}if("x"===t){for(r++;r<i;r++)if("_"!==(t=e[r])){if(!(48<=(n=e.charCodeAt(r))&&n<=57||65<=n&&n<=70||97<=n&&n<=102))return!1;o=!0}return o&&"_"!==t}if("o"===t){for(r++;r<i;r++)if("_"!==(t=e[r])){if(!w(e.charCodeAt(r)))return!1;o=!0}return o&&"_"!==t}}if("_"===t)return!1;for(;r<i;r++)if("_"!==(t=e[r])){if(!k(e.charCodeAt(r)))return!1;o=!0}return!(!o||"_"===t)},construct:function(e){var t,n=e,i=1;if(-1!==n.indexOf("_")&&(n=n.replace(/_/g,"")),"-"!==(t=n[0])&&"+"!==t||("-"===t&&(i=-1),t=(n=n.slice(1))[0]),"0"===n)return 0;if("0"===t){if("b"===n[1])return i*parseInt(n.slice(2),2);if("x"===n[1])return i*parseInt(n.slice(2),16);if("o"===n[1])return i*parseInt(n.slice(2),8)}return i*parseInt(n,10)},predicate:function(e){return"[object Number]"===Object.prototype.toString.call(e)&&e%1==0&&!n.isNegativeZero(e)},represent:{binary:function(e){return e>=0?"0b"+e.toString(2):"-0b"+e.toString(2).slice(1)},octal:function(e){return e>=0?"0o"+e.toString(8):"-0o"+e.toString(8).slice(1)},decimal:function(e){return e.toString(10)},hexadecimal:function(e){return e>=0?"0x"+e.toString(16).toUpperCase():"-0x"+e.toString(16).toUpperCase().slice(1)}},defaultStyle:"decimal",styleAliases:{binary:[2,"bin"],octal:[8,"oct"],decimal:[10,"dec"],hexadecimal:[16,"hex"]}}),x=new RegExp("^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");var I=/^[-+]?[0-9]+e/;var S=new p("tag:yaml.org,2002:float",{kind:"scalar",resolve:function(e){return null!==e&&!(!x.test(e)||"_"===e[e.length-1])},construct:function(e){var t,n;return n="-"===(t=e.replace(/_/g,"").toLowerCase())[0]?-1:1,"+-".indexOf(t[0])>=0&&(t=t.slice(1)),".inf"===t?1===n?Number.POSITIVE_INFINITY:Number.NEGATIVE_INFINITY:".nan"===t?NaN:n*parseFloat(t,10)},predicate:function(e){return"[object Number]"===Object.prototype.toString.call(e)&&(e%1!=0||n.isNegativeZero(e))},represent:function(e,t){var i;if(isNaN(e))switch(t){case"lowercase":return".nan";case"uppercase":return".NAN";case"camelcase":return".NaN"}else if(Number.POSITIVE_INFINITY===e)switch(t){case"lowercase":return".inf";case"uppercase":return".INF";case"camelcase":return".Inf"}else if(Number.NEGATIVE_INFINITY===e)switch(t){case"lowercase":return"-.inf";case"uppercase":return"-.INF";case"camelcase":return"-.Inf"}else if(n.isNegativeZero(e))return"-0.0";return i=e.toString(10),I.test(i)?i.replace("e",".e"):i},defaultStyle:"lowercase"}),O=b.extend({implicit:[A,v,C,S]}),j=O,T=new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"),N=new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$");var F=new p("tag:yaml.org,2002:timestamp",{kind:"scalar",resolve:function(e){return null!==e&&(null!==T.exec(e)||null!==N.exec(e))},construct:function(e){var t,n,i,r,o,a,l,c,s=0,u=null;if(null===(t=T.exec(e))&&(t=N.exec(e)),null===t)throw new Error("Date resolve error");if(n=+t[1],i=+t[2]-1,r=+t[3],!t[4])return new Date(Date.UTC(n,i,r));if(o=+t[4],a=+t[5],l=+t[6],t[7]){for(s=t[7].slice(0,3);s.length<3;)s+="0";s=+s}return t[9]&&(u=6e4*(60*+t[10]+ +(t[11]||0)),"-"===t[9]&&(u=-u)),c=new Date(Date.UTC(n,i,r,o,a,l,s)),u&&c.setTime(c.getTime()-u),c},instanceOf:Date,represent:function(e){return e.toISOString()}});var E=new p("tag:yaml.org,2002:merge",{kind:"scalar",resolve:function(e){return"<<"===e||null===e}}),M="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";var L=new p("tag:yaml.org,2002:binary",{kind:"scalar",resolve:function(e){if(null===e)return!1;var t,n,i=0,r=e.length,o=M;for(n=0;n<r;n++)if(!((t=o.indexOf(e.charAt(n)))>64)){if(t<0)return!1;i+=6}return i%8==0},construct:function(e){var t,n,i=e.replace(/[\r\n=]/g,""),r=i.length,o=M,a=0,l=[];for(t=0;t<r;t++)t%4==0&&t&&(l.push(a>>16&255),l.push(a>>8&255),l.push(255&a)),a=a<<6|o.indexOf(i.charAt(t));return 0===(n=r%4*6)?(l.push(a>>16&255),l.push(a>>8&255),l.push(255&a)):18===n?(l.push(a>>10&255),l.push(a>>2&255)):12===n&&l.push(a>>4&255),new Uint8Array(l)},predicate:function(e){return"[object Uint8Array]"===Object.prototype.toString.call(e)},represent:function(e){var t,n,i="",r=0,o=e.length,a=M;for(t=0;t<o;t++)t%3==0&&t&&(i+=a[r>>18&63],i+=a[r>>12&63],i+=a[r>>6&63],i+=a[63&r]),r=(r<<8)+e[t];return 0===(n=o%3)?(i+=a[r>>18&63],i+=a[r>>12&63],i+=a[r>>6&63],i+=a[63&r]):2===n?(i+=a[r>>10&63],i+=a[r>>4&63],i+=a[r<<2&63],i+=a[64]):1===n&&(i+=a[r>>2&63],i+=a[r<<4&63],i+=a[64],i+=a[64]),i}}),_=Object.prototype.hasOwnProperty,D=Object.prototype.toString;var U=new p("tag:yaml.org,2002:omap",{kind:"sequence",resolve:function(e){if(null===e)return!0;var t,n,i,r,o,a=[],l=e;for(t=0,n=l.length;t<n;t+=1){if(i=l[t],o=!1,"[object Object]"!==D.call(i))return!1;for(r in i)if(_.call(i,r)){if(o)return!1;o=!0}if(!o)return!1;if(-1!==a.indexOf(r))return!1;a.push(r)}return!0},construct:function(e){return null!==e?e:[]}}),q=Object.prototype.toString;var Y=new p("tag:yaml.org,2002:pairs",{kind:"sequence",resolve:function(e){if(null===e)return!0;var t,n,i,r,o,a=e;for(o=new Array(a.length),t=0,n=a.length;t<n;t+=1){if(i=a[t],"[object Object]"!==q.call(i))return!1;if(1!==(r=Object.keys(i)).length)return!1;o[t]=[r[0],i[r[0]]]}return!0},construct:function(e){if(null===e)return[];var t,n,i,r,o,a=e;for(o=new Array(a.length),t=0,n=a.length;t<n;t+=1)i=a[t],r=Object.keys(i),o[t]=[r[0],i[r[0]]];return o}}),R=Object.prototype.hasOwnProperty;var B=new p("tag:yaml.org,2002:set",{kind:"mapping",resolve:function(e){if(null===e)return!0;var t,n=e;for(t in n)if(R.call(n,t)&&null!==n[t])return!1;return!0},construct:function(e){return null!==e?e:{}}}),K=j.extend({implicit:[F,E],explicit:[L,U,Y,B]}),P=Object.prototype.hasOwnProperty,W=/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/,H=/[\x85\u2028\u2029]/,$=/[,\[\]\{\}]/,G=/^(?:!|!!|![a-z\-]+!)$/i,V=/^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;function Z(e){return Object.prototype.toString.call(e)}function J(e){return 10===e||13===e}function Q(e){return 9===e||32===e}function z(e){return 9===e||32===e||10===e||13===e}function X(e){return 44===e||91===e||93===e||123===e||125===e}function ee(e){var t;return 48<=e&&e<=57?e-48:97<=(t=32|e)&&t<=102?t-97+10:-1}function te(e){return 48===e?"\0":97===e?"":98===e?"\b":116===e||9===e?"\t":110===e?"\n":118===e?"\v":102===e?"\f":114===e?"\r":101===e?"":32===e?" ":34===e?'"':47===e?"/":92===e?"\\":78===e?"":95===e?" ":76===e?"\u2028":80===e?"\u2029":""}function ne(e){return e<=65535?String.fromCharCode(e):String.fromCharCode(55296+(e-65536>>10),56320+(e-65536&1023))}for(var ie=new Array(256),re=new Array(256),oe=0;oe<256;oe++)ie[oe]=te(oe)?1:0,re[oe]=te(oe);function ae(e,t){this.input=e,this.filename=t.filename||null,this.schema=t.schema||K,this.onWarning=t.onWarning||null,this.legacy=t.legacy||!1,this.json=t.json||!1,this.listener=t.listener||null,this.implicitTypes=this.schema.compiledImplicit,this.typeMap=this.schema.compiledTypeMap,this.length=e.length,this.position=0,this.line=0,this.lineStart=0,this.lineIndent=0,this.firstTabInLine=-1,this.documents=[]}function le(e,t){var n={name:e.filename,buffer:e.input.slice(0,-1),position:e.position,line:e.line,column:e.position-e.lineStart};return n.snippet=c(n),new o(t,n)}function ce(e,t){throw le(e,t)}function se(e,t){e.onWarning&&e.onWarning.call(null,le(e,t))}var ue={YAML:function(e,t,n){var i,r,o;null!==e.version&&ce(e,"duplication of %YAML directive"),1!==n.length&&ce(e,"YAML directive accepts exactly one argument"),null===(i=/^([0-9]+)\.([0-9]+)$/.exec(n[0]))&&ce(e,"ill-formed argument of the YAML directive"),r=parseInt(i[1],10),o=parseInt(i[2],10),1!==r&&ce(e,"unacceptable YAML version of the document"),e.version=n[0],e.checkLineBreaks=o<2,1!==o&&2!==o&&se(e,"unsupported YAML version of the document")},TAG:function(e,t,n){var i,r;2!==n.length&&ce(e,"TAG directive accepts exactly two arguments"),i=n[0],r=n[1],G.test(i)||ce(e,"ill-formed tag handle (first argument) of the TAG directive"),P.call(e.tagMap,i)&&ce(e,'there is a previously declared suffix for "'+i+'" tag handle'),V.test(r)||ce(e,"ill-formed tag prefix (second argument) of the TAG directive");try{r=decodeURIComponent(r)}catch(t){ce(e,"tag prefix is malformed: "+r)}e.tagMap[i]=r}};function pe(e,t,n,i){var r,o,a,l;if(t<n){if(l=e.input.slice(t,n),i)for(r=0,o=l.length;r<o;r+=1)9===(a=l.charCodeAt(r))||32<=a&&a<=1114111||ce(e,"expected valid JSON character");else W.test(l)&&ce(e,"the stream contains non-printable characters");e.result+=l}}function fe(e,t,i,r){var o,a,l,c;for(n.isObject(i)||ce(e,"cannot merge mappings; the provided source object is unacceptable"),l=0,c=(o=Object.keys(i)).length;l<c;l+=1)a=o[l],P.call(t,a)||(t[a]=i[a],r[a]=!0)}function de(e,t,n,i,r,o,a,l,c){var s,u;if(Array.isArray(r))for(s=0,u=(r=Array.prototype.slice.call(r)).length;s<u;s+=1)Array.isArray(r[s])&&ce(e,"nested arrays are not supported inside keys"),"object"==typeof r&&"[object Object]"===Z(r[s])&&(r[s]="[object Object]");if("object"==typeof r&&"[object Object]"===Z(r)&&(r="[object Object]"),r=String(r),null===t&&(t={}),"tag:yaml.org,2002:merge"===i)if(Array.isArray(o))for(s=0,u=o.length;s<u;s+=1)fe(e,t,o[s],n);else fe(e,t,o,n);else e.json||P.call(n,r)||!P.call(t,r)||(e.line=a||e.line,e.lineStart=l||e.lineStart,e.position=c||e.position,ce(e,"duplicated mapping key")),"__proto__"===r?Object.defineProperty(t,r,{configurable:!0,enumerable:!0,writable:!0,value:o}):t[r]=o,delete n[r];return t}function he(e){var t;10===(t=e.input.charCodeAt(e.position))?e.position++:13===t?(e.position++,10===e.input.charCodeAt(e.position)&&e.position++):ce(e,"a line break is expected"),e.line+=1,e.lineStart=e.position,e.firstTabInLine=-1}function ge(e,t,n){for(var i=0,r=e.input.charCodeAt(e.position);0!==r;){for(;Q(r);)9===r&&-1===e.firstTabInLine&&(e.firstTabInLine=e.position),r=e.input.charCodeAt(++e.position);if(t&&35===r)do{r=e.input.charCodeAt(++e.position)}while(10!==r&&13!==r&&0!==r);if(!J(r))break;for(he(e),r=e.input.charCodeAt(e.position),i++,e.lineIndent=0;32===r;)e.lineIndent++,r=e.input.charCodeAt(++e.position)}return-1!==n&&0!==i&&e.lineIndent<n&&se(e,"deficient indentation"),i}function me(e){var t,n=e.position;return!(45!==(t=e.input.charCodeAt(n))&&46!==t||t!==e.input.charCodeAt(n+1)||t!==e.input.charCodeAt(n+2)||(n+=3,0!==(t=e.input.charCodeAt(n))&&!z(t)))}function ye(e,t){1===t?e.result+=" ":t>1&&(e.result+=n.repeat("\n",t-1))}function be(e,t){var n,i,r=e.tag,o=e.anchor,a=[],l=!1;if(-1!==e.firstTabInLine)return!1;for(null!==e.anchor&&(e.anchorMap[e.anchor]=a),i=e.input.charCodeAt(e.position);0!==i&&(-1!==e.firstTabInLine&&(e.position=e.firstTabInLine,ce(e,"tab characters must not be used in indentation")),45===i)&&z(e.input.charCodeAt(e.position+1));)if(l=!0,e.position++,ge(e,!0,-1)&&e.lineIndent<=t)a.push(null),i=e.input.charCodeAt(e.position);else if(n=e.line,we(e,t,3,!1,!0),a.push(e.result),ge(e,!0,-1),i=e.input.charCodeAt(e.position),(e.line===n||e.lineIndent>t)&&0!==i)ce(e,"bad indentation of a sequence entry");else if(e.lineIndent<t)break;return!!l&&(e.tag=r,e.anchor=o,e.kind="sequence",e.result=a,!0)}function Ae(e){var t,n,i,r,o=!1,a=!1;if(33!==(r=e.input.charCodeAt(e.position)))return!1;if(null!==e.tag&&ce(e,"duplication of a tag property"),60===(r=e.input.charCodeAt(++e.position))?(o=!0,r=e.input.charCodeAt(++e.position)):33===r?(a=!0,n="!!",r=e.input.charCodeAt(++e.position)):n="!",t=e.position,o){do{r=e.input.charCodeAt(++e.position)}while(0!==r&&62!==r);e.position<e.length?(i=e.input.slice(t,e.position),r=e.input.charCodeAt(++e.position)):ce(e,"unexpected end of the stream within a verbatim tag")}else{for(;0!==r&&!z(r);)33===r&&(a?ce(e,"tag suffix cannot contain exclamation marks"):(n=e.input.slice(t-1,e.position+1),G.test(n)||ce(e,"named tag handle cannot contain such characters"),a=!0,t=e.position+1)),r=e.input.charCodeAt(++e.position);i=e.input.slice(t,e.position),$.test(i)&&ce(e,"tag suffix cannot contain flow indicator characters")}i&&!V.test(i)&&ce(e,"tag name cannot contain such characters: "+i);try{i=decodeURIComponent(i)}catch(t){ce(e,"tag name is malformed: "+i)}return o?e.tag=i:P.call(e.tagMap,n)?e.tag=e.tagMap[n]+i:"!"===n?e.tag="!"+i:"!!"===n?e.tag="tag:yaml.org,2002:"+i:ce(e,'undeclared tag handle "'+n+'"'),!0}function ve(e){var t,n;if(38!==(n=e.input.charCodeAt(e.position)))return!1;for(null!==e.anchor&&ce(e,"duplication of an anchor property"),n=e.input.charCodeAt(++e.position),t=e.position;0!==n&&!z(n)&&!X(n);)n=e.input.charCodeAt(++e.position);return e.position===t&&ce(e,"name of an anchor node must contain at least one character"),e.anchor=e.input.slice(t,e.position),!0}function we(e,t,i,r,o){var a,l,c,s,u,p,f,d,h,g=1,m=!1,y=!1;if(null!==e.listener&&e.listener("open",e),e.tag=null,e.anchor=null,e.kind=null,e.result=null,a=l=c=4===i||3===i,r&&ge(e,!0,-1)&&(m=!0,e.lineIndent>t?g=1:e.lineIndent===t?g=0:e.lineIndent<t&&(g=-1)),1===g)for(;Ae(e)||ve(e);)ge(e,!0,-1)?(m=!0,c=a,e.lineIndent>t?g=1:e.lineIndent===t?g=0:e.lineIndent<t&&(g=-1)):c=!1;if(c&&(c=m||o),1!==g&&4!==i||(d=1===i||2===i?t:t+1,h=e.position-e.lineStart,1===g?c&&(be(e,h)||function(e,t,n){var i,r,o,a,l,c,s,u=e.tag,p=e.anchor,f={},d=Object.create(null),h=null,g=null,m=null,y=!1,b=!1;if(-1!==e.firstTabInLine)return!1;for(null!==e.anchor&&(e.anchorMap[e.anchor]=f),s=e.input.charCodeAt(e.position);0!==s;){if(y||-1===e.firstTabInLine||(e.position=e.firstTabInLine,ce(e,"tab characters must not be used in indentation")),i=e.input.charCodeAt(e.position+1),o=e.line,63!==s&&58!==s||!z(i)){if(a=e.line,l=e.lineStart,c=e.position,!we(e,n,2,!1,!0))break;if(e.line===o){for(s=e.input.charCodeAt(e.position);Q(s);)s=e.input.charCodeAt(++e.position);if(58===s)z(s=e.input.charCodeAt(++e.position))||ce(e,"a whitespace character is expected after the key-value separator within a block mapping"),y&&(de(e,f,d,h,g,null,a,l,c),h=g=m=null),b=!0,y=!1,r=!1,h=e.tag,g=e.result;else{if(!b)return e.tag=u,e.anchor=p,!0;ce(e,"can not read an implicit mapping pair; a colon is missed")}}else{if(!b)return e.tag=u,e.anchor=p,!0;ce(e,"can not read a block mapping entry; a multiline key may not be an implicit key")}}else 63===s?(y&&(de(e,f,d,h,g,null,a,l,c),h=g=m=null),b=!0,y=!0,r=!0):y?(y=!1,r=!0):ce(e,"incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line"),e.position+=1,s=i;if((e.line===o||e.lineIndent>t)&&(y&&(a=e.line,l=e.lineStart,c=e.position),we(e,t,4,!0,r)&&(y?g=e.result:m=e.result),y||(de(e,f,d,h,g,m,a,l,c),h=g=m=null),ge(e,!0,-1),s=e.input.charCodeAt(e.position)),(e.line===o||e.lineIndent>t)&&0!==s)ce(e,"bad indentation of a mapping entry");else if(e.lineIndent<t)break}return y&&de(e,f,d,h,g,null,a,l,c),b&&(e.tag=u,e.anchor=p,e.kind="mapping",e.result=f),b}(e,h,d))||function(e,t){var n,i,r,o,a,l,c,s,u,p,f,d,h=!0,g=e.tag,m=e.anchor,y=Object.create(null);if(91===(d=e.input.charCodeAt(e.position)))a=93,s=!1,o=[];else{if(123!==d)return!1;a=125,s=!0,o={}}for(null!==e.anchor&&(e.anchorMap[e.anchor]=o),d=e.input.charCodeAt(++e.position);0!==d;){if(ge(e,!0,t),(d=e.input.charCodeAt(e.position))===a)return e.position++,e.tag=g,e.anchor=m,e.kind=s?"mapping":"sequence",e.result=o,!0;h?44===d&&ce(e,"expected the node content, but found ','"):ce(e,"missed comma between flow collection entries"),f=null,l=c=!1,63===d&&z(e.input.charCodeAt(e.position+1))&&(l=c=!0,e.position++,ge(e,!0,t)),n=e.line,i=e.lineStart,r=e.position,we(e,t,1,!1,!0),p=e.tag,u=e.result,ge(e,!0,t),d=e.input.charCodeAt(e.position),!c&&e.line!==n||58!==d||(l=!0,d=e.input.charCodeAt(++e.position),ge(e,!0,t),we(e,t,1,!1,!0),f=e.result),s?de(e,o,y,p,u,f,n,i,r):l?o.push(de(e,null,y,p,u,f,n,i,r)):o.push(u),ge(e,!0,t),44===(d=e.input.charCodeAt(e.position))?(h=!0,d=e.input.charCodeAt(++e.position)):h=!1}ce(e,"unexpected end of the stream within a flow collection")}(e,d)?y=!0:(l&&function(e,t){var i,r,o,a,l,c=1,s=!1,u=!1,p=t,f=0,d=!1;if(124===(a=e.input.charCodeAt(e.position)))r=!1;else{if(62!==a)return!1;r=!0}for(e.kind="scalar",e.result="";0!==a;)if(43===(a=e.input.charCodeAt(++e.position))||45===a)1===c?c=43===a?3:2:ce(e,"repeat of a chomping mode identifier");else{if(!((o=48<=(l=a)&&l<=57?l-48:-1)>=0))break;0===o?ce(e,"bad explicit indentation width of a block scalar; it cannot be less than one"):u?ce(e,"repeat of an indentation width identifier"):(p=t+o-1,u=!0)}if(Q(a)){do{a=e.input.charCodeAt(++e.position)}while(Q(a));if(35===a)do{a=e.input.charCodeAt(++e.position)}while(!J(a)&&0!==a)}for(;0!==a;){for(he(e),e.lineIndent=0,a=e.input.charCodeAt(e.position);(!u||e.lineIndent<p)&&32===a;)e.lineIndent++,a=e.input.charCodeAt(++e.position);if(!u&&e.lineIndent>p&&(p=e.lineIndent),J(a))f++;else{if(e.lineIndent<p){3===c?e.result+=n.repeat("\n",s?1+f:f):1===c&&s&&(e.result+="\n");break}for(r?Q(a)?(d=!0,e.result+=n.repeat("\n",s?1+f:f)):d?(d=!1,e.result+=n.repeat("\n",f+1)):0===f?s&&(e.result+=" "):e.result+=n.repeat("\n",f):e.result+=n.repeat("\n",s?1+f:f),s=!0,u=!0,f=0,i=e.position;!J(a)&&0!==a;)a=e.input.charCodeAt(++e.position);pe(e,i,e.position,!1)}}return!0}(e,d)||function(e,t){var n,i,r;if(39!==(n=e.input.charCodeAt(e.position)))return!1;for(e.kind="scalar",e.result="",e.position++,i=r=e.position;0!==(n=e.input.charCodeAt(e.position));)if(39===n){if(pe(e,i,e.position,!0),39!==(n=e.input.charCodeAt(++e.position)))return!0;i=e.position,e.position++,r=e.position}else J(n)?(pe(e,i,r,!0),ye(e,ge(e,!1,t)),i=r=e.position):e.position===e.lineStart&&me(e)?ce(e,"unexpected end of the document within a single quoted scalar"):(e.position++,r=e.position);ce(e,"unexpected end of the stream within a single quoted scalar")}(e,d)||function(e,t){var n,i,r,o,a,l,c;if(34!==(l=e.input.charCodeAt(e.position)))return!1;for(e.kind="scalar",e.result="",e.position++,n=i=e.position;0!==(l=e.input.charCodeAt(e.position));){if(34===l)return pe(e,n,e.position,!0),e.position++,!0;if(92===l){if(pe(e,n,e.position,!0),J(l=e.input.charCodeAt(++e.position)))ge(e,!1,t);else if(l<256&&ie[l])e.result+=re[l],e.position++;else if((a=120===(c=l)?2:117===c?4:85===c?8:0)>0){for(r=a,o=0;r>0;r--)(a=ee(l=e.input.charCodeAt(++e.position)))>=0?o=(o<<4)+a:ce(e,"expected hexadecimal character");e.result+=ne(o),e.position++}else ce(e,"unknown escape sequence");n=i=e.position}else J(l)?(pe(e,n,i,!0),ye(e,ge(e,!1,t)),n=i=e.position):e.position===e.lineStart&&me(e)?ce(e,"unexpected end of the document within a double quoted scalar"):(e.position++,i=e.position)}ce(e,"unexpected end of the stream within a double quoted scalar")}(e,d)?y=!0:!function(e){var t,n,i;if(42!==(i=e.input.charCodeAt(e.position)))return!1;for(i=e.input.charCodeAt(++e.position),t=e.position;0!==i&&!z(i)&&!X(i);)i=e.input.charCodeAt(++e.position);return e.position===t&&ce(e,"name of an alias node must contain at least one character"),n=e.input.slice(t,e.position),P.call(e.anchorMap,n)||ce(e,'unidentified alias "'+n+'"'),e.result=e.anchorMap[n],ge(e,!0,-1),!0}(e)?function(e,t,n){var i,r,o,a,l,c,s,u,p=e.kind,f=e.result;if(z(u=e.input.charCodeAt(e.position))||X(u)||35===u||38===u||42===u||33===u||124===u||62===u||39===u||34===u||37===u||64===u||96===u)return!1;if((63===u||45===u)&&(z(i=e.input.charCodeAt(e.position+1))||n&&X(i)))return!1;for(e.kind="scalar",e.result="",r=o=e.position,a=!1;0!==u;){if(58===u){if(z(i=e.input.charCodeAt(e.position+1))||n&&X(i))break}else if(35===u){if(z(e.input.charCodeAt(e.position-1)))break}else{if(e.position===e.lineStart&&me(e)||n&&X(u))break;if(J(u)){if(l=e.line,c=e.lineStart,s=e.lineIndent,ge(e,!1,-1),e.lineIndent>=t){a=!0,u=e.input.charCodeAt(e.position);continue}e.position=o,e.line=l,e.lineStart=c,e.lineIndent=s;break}}a&&(pe(e,r,o,!1),ye(e,e.line-l),r=o=e.position,a=!1),Q(u)||(o=e.position+1),u=e.input.charCodeAt(++e.position)}return pe(e,r,o,!1),!!e.result||(e.kind=p,e.result=f,!1)}(e,d,1===i)&&(y=!0,null===e.tag&&(e.tag="?")):(y=!0,null===e.tag&&null===e.anchor||ce(e,"alias node should not have any properties")),null!==e.anchor&&(e.anchorMap[e.anchor]=e.result)):0===g&&(y=c&&be(e,h))),null===e.tag)null!==e.anchor&&(e.anchorMap[e.anchor]=e.result);else if("?"===e.tag){for(null!==e.result&&"scalar"!==e.kind&&ce(e,'unacceptable node kind for !<?> tag; it should be "scalar", not "'+e.kind+'"'),s=0,u=e.implicitTypes.length;s<u;s+=1)if((f=e.implicitTypes[s]).resolve(e.result)){e.result=f.construct(e.result),e.tag=f.tag,null!==e.anchor&&(e.anchorMap[e.anchor]=e.result);break}}else if("!"!==e.tag){if(P.call(e.typeMap[e.kind||"fallback"],e.tag))f=e.typeMap[e.kind||"fallback"][e.tag];else for(f=null,s=0,u=(p=e.typeMap.multi[e.kind||"fallback"]).length;s<u;s+=1)if(e.tag.slice(0,p[s].tag.length)===p[s].tag){f=p[s];break}f||ce(e,"unknown tag !<"+e.tag+">"),null!==e.result&&f.kind!==e.kind&&ce(e,"unacceptable node kind for !<"+e.tag+'> tag; it should be "'+f.kind+'", not "'+e.kind+'"'),f.resolve(e.result,e.tag)?(e.result=f.construct(e.result,e.tag),null!==e.anchor&&(e.anchorMap[e.anchor]=e.result)):ce(e,"cannot resolve a node with !<"+e.tag+"> explicit tag")}return null!==e.listener&&e.listener("close",e),null!==e.tag||null!==e.anchor||y}function ke(e){var t,n,i,r,o=e.position,a=!1;for(e.version=null,e.checkLineBreaks=e.legacy,e.tagMap=Object.create(null),e.anchorMap=Object.create(null);0!==(r=e.input.charCodeAt(e.position))&&(ge(e,!0,-1),r=e.input.charCodeAt(e.position),!(e.lineIndent>0||37!==r));){for(a=!0,r=e.input.charCodeAt(++e.position),t=e.position;0!==r&&!z(r);)r=e.input.charCodeAt(++e.position);for(i=[],(n=e.input.slice(t,e.position)).length<1&&ce(e,"directive name must not be less than one character in length");0!==r;){for(;Q(r);)r=e.input.charCodeAt(++e.position);if(35===r){do{r=e.input.charCodeAt(++e.position)}while(0!==r&&!J(r));break}if(J(r))break;for(t=e.position;0!==r&&!z(r);)r=e.input.charCodeAt(++e.position);i.push(e.input.slice(t,e.position))}0!==r&&he(e),P.call(ue,n)?ue[n](e,n,i):se(e,'unknown document directive "'+n+'"')}ge(e,!0,-1),0===e.lineIndent&&45===e.input.charCodeAt(e.position)&&45===e.input.charCodeAt(e.position+1)&&45===e.input.charCodeAt(e.position+2)?(e.position+=3,ge(e,!0,-1)):a&&ce(e,"directives end mark is expected"),we(e,e.lineIndent-1,4,!1,!0),ge(e,!0,-1),e.checkLineBreaks&&H.test(e.input.slice(o,e.position))&&se(e,"non-ASCII line breaks are interpreted as content"),e.documents.push(e.result),e.position===e.lineStart&&me(e)?46===e.input.charCodeAt(e.position)&&(e.position+=3,ge(e,!0,-1)):e.position<e.length-1&&ce(e,"end of the stream or a document separator is expected")}function Ce(e,t){t=t||{},0!==(e=String(e)).length&&(10!==e.charCodeAt(e.length-1)&&13!==e.charCodeAt(e.length-1)&&(e+="\n"),65279===e.charCodeAt(0)&&(e=e.slice(1)));var n=new ae(e,t),i=e.indexOf("\0");for(-1!==i&&(n.position=i,ce(n,"null byte is not allowed in input")),n.input+="\0";32===n.input.charCodeAt(n.position);)n.lineIndent+=1,n.position+=1;for(;n.position<n.length-1;)ke(n);return n.documents}var xe={loadAll:function(e,t,n){null!==t&&"object"==typeof t&&void 0===n&&(n=t,t=null);var i=Ce(e,n);if("function"!=typeof t)return i;for(var r=0,o=i.length;r<o;r+=1)t(i[r])},load:function(e,t){var n=Ce(e,t);if(0!==n.length){if(1===n.length)return n[0];throw new o("expected a single document in the stream, but found more")}}},Ie=Object.prototype.toString,Se=Object.prototype.hasOwnProperty,Oe=65279,je={0:"\\0",7:"\\a",8:"\\b",9:"\\t",10:"\\n",11:"\\v",12:"\\f",13:"\\r",27:"\\e",34:'\\"',92:"\\\\",133:"\\N",160:"\\_",8232:"\\L",8233:"\\P"},Te=["y","Y","yes","Yes","YES","on","On","ON","n","N","no","No","NO","off","Off","OFF"],Ne=/^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;function Fe(e){var t,i,r;if(t=e.toString(16).toUpperCase(),e<=255)i="x",r=2;else if(e<=65535)i="u",r=4;else{if(!(e<=4294967295))throw new o("code point within a string may not be greater than 0xFFFFFFFF");i="U",r=8}return"\\"+i+n.repeat("0",r-t.length)+t}function Ee(e){this.schema=e.schema||K,this.indent=Math.max(1,e.indent||2),this.noArrayIndent=e.noArrayIndent||!1,this.skipInvalid=e.skipInvalid||!1,this.flowLevel=n.isNothing(e.flowLevel)?-1:e.flowLevel,this.styleMap=function(e,t){var n,i,r,o,a,l,c;if(null===t)return{};for(n={},r=0,o=(i=Object.keys(t)).length;r<o;r+=1)a=i[r],l=String(t[a]),"!!"===a.slice(0,2)&&(a="tag:yaml.org,2002:"+a.slice(2)),(c=e.compiledTypeMap.fallback[a])&&Se.call(c.styleAliases,l)&&(l=c.styleAliases[l]),n[a]=l;return n}(this.schema,e.styles||null),this.sortKeys=e.sortKeys||!1,this.lineWidth=e.lineWidth||80,this.noRefs=e.noRefs||!1,this.noCompatMode=e.noCompatMode||!1,this.condenseFlow=e.condenseFlow||!1,this.quotingType='"'===e.quotingType?2:1,this.forceQuotes=e.forceQuotes||!1,this.replacer="function"==typeof e.replacer?e.replacer:null,this.implicitTypes=this.schema.compiledImplicit,this.explicitTypes=this.schema.compiledExplicit,this.tag=null,this.result="",this.duplicates=[],this.usedDuplicates=null}function Me(e,t){for(var i,r=n.repeat(" ",t),o=0,a=-1,l="",c=e.length;o<c;)-1===(a=e.indexOf("\n",o))?(i=e.slice(o),o=c):(i=e.slice(o,a+1),o=a+1),i.length&&"\n"!==i&&(l+=r),l+=i;return l}function Le(e,t){return"\n"+n.repeat(" ",e.indent*t)}function _e(e){return 32===e||9===e}function De(e){return 32<=e&&e<=126||161<=e&&e<=55295&&8232!==e&&8233!==e||57344<=e&&e<=65533&&e!==Oe||65536<=e&&e<=1114111}function Ue(e){return De(e)&&e!==Oe&&13!==e&&10!==e}function qe(e,t,n){var i=Ue(e),r=i&&!_e(e);return(n?i:i&&44!==e&&91!==e&&93!==e&&123!==e&&125!==e)&&35!==e&&!(58===t&&!r)||Ue(t)&&!_e(t)&&35===e||58===t&&r}function Ye(e,t){var n,i=e.charCodeAt(t);return i>=55296&&i<=56319&&t+1<e.length&&(n=e.charCodeAt(t+1))>=56320&&n<=57343?1024*(i-55296)+n-56320+65536:i}function Re(e){return/^\n* /.test(e)}function Be(e,t,n,i,r,o,a,l){var c,s,u=0,p=null,f=!1,d=!1,h=-1!==i,g=-1,m=De(s=Ye(e,0))&&s!==Oe&&!_e(s)&&45!==s&&63!==s&&58!==s&&44!==s&&91!==s&&93!==s&&123!==s&&125!==s&&35!==s&&38!==s&&42!==s&&33!==s&&124!==s&&61!==s&&62!==s&&39!==s&&34!==s&&37!==s&&64!==s&&96!==s&&function(e){return!_e(e)&&58!==e}(Ye(e,e.length-1));if(t||a)for(c=0;c<e.length;u>=65536?c+=2:c++){if(!De(u=Ye(e,c)))return 5;m=m&&qe(u,p,l),p=u}else{for(c=0;c<e.length;u>=65536?c+=2:c++){if(10===(u=Ye(e,c)))f=!0,h&&(d=d||c-g-1>i&&" "!==e[g+1],g=c);else if(!De(u))return 5;m=m&&qe(u,p,l),p=u}d=d||h&&c-g-1>i&&" "!==e[g+1]}return f||d?n>9&&Re(e)?5:a?2===o?5:2:d?4:3:!m||a||r(e)?2===o?5:2:1}function Ke(e,t,n,i,r){e.dump=function(){if(0===t.length)return 2===e.quotingType?'""':"''";if(!e.noCompatMode&&(-1!==Te.indexOf(t)||Ne.test(t)))return 2===e.quotingType?'"'+t+'"':"'"+t+"'";var a=e.indent*Math.max(1,n),l=-1===e.lineWidth?-1:Math.max(Math.min(e.lineWidth,40),e.lineWidth-a),c=i||e.flowLevel>-1&&n>=e.flowLevel;switch(Be(t,c,e.indent,l,(function(t){return function(e,t){var n,i;for(n=0,i=e.implicitTypes.length;n<i;n+=1)if(e.implicitTypes[n].resolve(t))return!0;return!1}(e,t)}),e.quotingType,e.forceQuotes&&!i,r)){case 1:return t;case 2:return"'"+t.replace(/'/g,"''")+"'";case 3:return"|"+Pe(t,e.indent)+We(Me(t,a));case 4:return">"+Pe(t,e.indent)+We(Me(function(e,t){var n,i,r=/(\n+)([^\n]*)/g,o=(l=e.indexOf("\n"),l=-1!==l?l:e.length,r.lastIndex=l,He(e.slice(0,l),t)),a="\n"===e[0]||" "===e[0];var l;for(;i=r.exec(e);){var c=i[1],s=i[2];n=" "===s[0],o+=c+(a||n||""===s?"":"\n")+He(s,t),a=n}return o}(t,l),a));case 5:return'"'+function(e){for(var t,n="",i=0,r=0;r<e.length;i>=65536?r+=2:r++)i=Ye(e,r),!(t=je[i])&&De(i)?(n+=e[r],i>=65536&&(n+=e[r+1])):n+=t||Fe(i);return n}(t)+'"';default:throw new o("impossible error: invalid scalar style")}}()}function Pe(e,t){var n=Re(e)?String(t):"",i="\n"===e[e.length-1];return n+(i&&("\n"===e[e.length-2]||"\n"===e)?"+":i?"":"-")+"\n"}function We(e){return"\n"===e[e.length-1]?e.slice(0,-1):e}function He(e,t){if(""===e||" "===e[0])return e;for(var n,i,r=/ [^ ]/g,o=0,a=0,l=0,c="";n=r.exec(e);)(l=n.index)-o>t&&(i=a>o?a:l,c+="\n"+e.slice(o,i),o=i+1),a=l;return c+="\n",e.length-o>t&&a>o?c+=e.slice(o,a)+"\n"+e.slice(a+1):c+=e.slice(o),c.slice(1)}function $e(e,t,n,i){var r,o,a,l="",c=e.tag;for(r=0,o=n.length;r<o;r+=1)a=n[r],e.replacer&&(a=e.replacer.call(n,String(r),a)),(Ve(e,t+1,a,!0,!0,!1,!0)||void 0===a&&Ve(e,t+1,null,!0,!0,!1,!0))&&(i&&""===l||(l+=Le(e,t)),e.dump&&10===e.dump.charCodeAt(0)?l+="-":l+="- ",l+=e.dump);e.tag=c,e.dump=l||"[]"}function Ge(e,t,n){var i,r,a,l,c,s;for(a=0,l=(r=n?e.explicitTypes:e.implicitTypes).length;a<l;a+=1)if(((c=r[a]).instanceOf||c.predicate)&&(!c.instanceOf||"object"==typeof t&&t instanceof c.instanceOf)&&(!c.predicate||c.predicate(t))){if(n?c.multi&&c.representName?e.tag=c.representName(t):e.tag=c.tag:e.tag="?",c.represent){if(s=e.styleMap[c.tag]||c.defaultStyle,"[object Function]"===Ie.call(c.represent))i=c.represent(t,s);else{if(!Se.call(c.represent,s))throw new o("!<"+c.tag+'> tag resolver accepts not "'+s+'" style');i=c.represent[s](t,s)}e.dump=i}return!0}return!1}function Ve(e,t,n,i,r,a,l){e.tag=null,e.dump=n,Ge(e,n,!1)||Ge(e,n,!0);var c,s=Ie.call(e.dump),u=i;i&&(i=e.flowLevel<0||e.flowLevel>t);var p,f,d="[object Object]"===s||"[object Array]"===s;if(d&&(f=-1!==(p=e.duplicates.indexOf(n))),(null!==e.tag&&"?"!==e.tag||f||2!==e.indent&&t>0)&&(r=!1),f&&e.usedDuplicates[p])e.dump="*ref_"+p;else{if(d&&f&&!e.usedDuplicates[p]&&(e.usedDuplicates[p]=!0),"[object Object]"===s)i&&0!==Object.keys(e.dump).length?(!function(e,t,n,i){var r,a,l,c,s,u,p="",f=e.tag,d=Object.keys(n);if(!0===e.sortKeys)d.sort();else if("function"==typeof e.sortKeys)d.sort(e.sortKeys);else if(e.sortKeys)throw new o("sortKeys must be a boolean or a function");for(r=0,a=d.length;r<a;r+=1)u="",i&&""===p||(u+=Le(e,t)),c=n[l=d[r]],e.replacer&&(c=e.replacer.call(n,l,c)),Ve(e,t+1,l,!0,!0,!0)&&((s=null!==e.tag&&"?"!==e.tag||e.dump&&e.dump.length>1024)&&(e.dump&&10===e.dump.charCodeAt(0)?u+="?":u+="? "),u+=e.dump,s&&(u+=Le(e,t)),Ve(e,t+1,c,!0,s)&&(e.dump&&10===e.dump.charCodeAt(0)?u+=":":u+=": ",p+=u+=e.dump));e.tag=f,e.dump=p||"{}"}(e,t,e.dump,r),f&&(e.dump="&ref_"+p+e.dump)):(!function(e,t,n){var i,r,o,a,l,c="",s=e.tag,u=Object.keys(n);for(i=0,r=u.length;i<r;i+=1)l="",""!==c&&(l+=", "),e.condenseFlow&&(l+='"'),a=n[o=u[i]],e.replacer&&(a=e.replacer.call(n,o,a)),Ve(e,t,o,!1,!1)&&(e.dump.length>1024&&(l+="? "),l+=e.dump+(e.condenseFlow?'"':"")+":"+(e.condenseFlow?"":" "),Ve(e,t,a,!1,!1)&&(c+=l+=e.dump));e.tag=s,e.dump="{"+c+"}"}(e,t,e.dump),f&&(e.dump="&ref_"+p+" "+e.dump));else if("[object Array]"===s)i&&0!==e.dump.length?(e.noArrayIndent&&!l&&t>0?$e(e,t-1,e.dump,r):$e(e,t,e.dump,r),f&&(e.dump="&ref_"+p+e.dump)):(!function(e,t,n){var i,r,o,a="",l=e.tag;for(i=0,r=n.length;i<r;i+=1)o=n[i],e.replacer&&(o=e.replacer.call(n,String(i),o)),(Ve(e,t,o,!1,!1)||void 0===o&&Ve(e,t,null,!1,!1))&&(""!==a&&(a+=","+(e.condenseFlow?"":" ")),a+=e.dump);e.tag=l,e.dump="["+a+"]"}(e,t,e.dump),f&&(e.dump="&ref_"+p+" "+e.dump));else{if("[object String]"!==s){if("[object Undefined]"===s)return!1;if(e.skipInvalid)return!1;throw new o("unacceptable kind of an object to dump "+s)}"?"!==e.tag&&Ke(e,e.dump,t,a,u)}null!==e.tag&&"?"!==e.tag&&(c=encodeURI("!"===e.tag[0]?e.tag.slice(1):e.tag).replace(/!/g,"%21"),c="!"===e.tag[0]?"!"+c:"tag:yaml.org,2002:"===c.slice(0,18)?"!!"+c.slice(18):"!<"+c+">",e.dump=c+" "+e.dump)}return!0}function Ze(e,t){var n,i,r=[],o=[];for(Je(e,r,o),n=0,i=o.length;n<i;n+=1)t.duplicates.push(r[o[n]]);t.usedDuplicates=new Array(i)}function Je(e,t,n){var i,r,o;if(null!==e&&"object"==typeof e)if(-1!==(r=t.indexOf(e)))-1===n.indexOf(r)&&n.push(r);else if(t.push(e),Array.isArray(e))for(r=0,o=e.length;r<o;r+=1)Je(e[r],t,n);else for(r=0,o=(i=Object.keys(e)).length;r<o;r+=1)Je(e[i[r]],t,n)}function Qe(e,t){return function(){throw new Error("Function yaml."+e+" is removed in js-yaml 4. Use yaml."+t+" instead, which is now safe by default.")}}var ze=p,Xe=h,et=b,tt=O,nt=j,it=K,rt=xe.load,ot=xe.loadAll,at={dump:function(e,t){var n=new Ee(t=t||{});n.noRefs||Ze(e,n);var i=e;return n.replacer&&(i=n.replacer.call({"":i},"",i)),Ve(n,0,i,!0,!0)?n.dump+"\n":""}}.dump,lt=o,ct={binary:L,float:S,map:y,null:A,pairs:Y,set:B,timestamp:F,bool:v,int:C,merge:E,omap:U,seq:m,str:g},st=Qe("safeLoad","load"),ut=Qe("safeLoadAll","loadAll"),pt=Qe("safeDump","dump"),ft={Type:ze,Schema:Xe,FAILSAFE_SCHEMA:et,JSON_SCHEMA:tt,CORE_SCHEMA:nt,DEFAULT_SCHEMA:it,load:rt,loadAll:ot,dump:at,YAMLException:lt,types:ct,safeLoad:st,safeLoadAll:ut,safeDump:pt};e.CORE_SCHEMA=nt,e.DEFAULT_SCHEMA=it,e.FAILSAFE_SCHEMA=et,e.JSON_SCHEMA=tt,e.Schema=Xe,e.Type=ze,e.YAMLException=lt,e.default=ft,e.dump=at,e.load=rt,e.loadAll=ot,e.safeDump=pt,e.safeLoad=st,e.safeLoadAll=ut,e.types=ct,Object.defineProperty(e,"__esModule",{value:!0})}));
// --- END JS-YAML ---

const yaml = module.exports;

// ====== [MODULE: 02b_resolver.js] ======
// ============================================================================
// Mihomo 节点解析器：URI / YAML / Base64 订阅内容 -> 规范化节点对象数组
// ============================================================================

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

function parseAnytls(uri) {
    let parsed;
    try { parsed = new URL(uri); } catch(e) { return null; }
    if (!parsed.hostname || !parsed.port) return null;
    const params = parsed.searchParams;
    const name = parsed.hash ? decodeURIComponent(parsed.hash.slice(1)).trim() : `${parsed.hostname}:${parsed.port}`;
    const node = { name, type: "anytls", server: parsed.hostname, port: parseInt(parsed.port), password: parsed.username ? decodeURIComponent(parsed.username) : "" };
    if (params.has("udp")) node.udp = parseBool(params.get("udp"));
    setIfPresent(node, "sni", getParam(params, "sni"));
    const insecure = getParam(params, "skip-cert-verify") || getParam(params, "insecure") || getParam(params, "allowInsecure");
    if (insecure) node["skip-cert-verify"] = parseBool(insecure);
    const alpn = getParam(params, "alpn");
    if (alpn) node.alpn = decodeURIComponent(alpn).split(",");
    for (const key of ["min-idle-session", "idle-session-check-interval", "idle-session-timeout"]) setIfPresent(node, key, getParam(params, key));
    return node;
}
const SCHEME_MAP = {
    "ss": "ss",
    "vmess": "vmess",
    "vless": "vless",
    "trojan": "trojan",
    "hysteria": "hysteria",
    "hysteria2": "hysteria2",
    "anytls": "anytls",
    "hy2": "hysteria2"
};

const URI_PARSERS = {
    "ss": parseSs,
    "vmess": parseVmess,
    "vless": parseVless,
    "trojan": parseTrojan,
    "hysteria": parseHysteria,
    "hysteria2": parseHysteria2,
    "anytls": parseAnytls,
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

    const yamlNodes = parseYamlContent(content);
    if (yamlNodes !== null) return yamlNodes;
    
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
        if (typeof data !== 'object' || data === null || !Array.isArray(data.proxies)) return null;
        return data.proxies;
    } catch (e) {
        return null;
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

const ALLOWED_TYPES = new Set(["ss", "vmess", "vless", "trojan", "hysteria", "hysteria2", "anytls"]);

function cleanNode(value, ancestors = new WeakSet(), depth = 0) {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'object') return value;
    if (depth > MAX_NODE_DEPTH) throw new Error(`节点嵌套层级不能超过 ${MAX_NODE_DEPTH} 层`);
    if (ancestors.has(value)) throw new Error('节点内容包含循环引用');

    ancestors.add(value);
    try {
        if (Array.isArray(value)) {
            return value
                .map(item => cleanNode(item, ancestors, depth + 1))
                .filter(item => item !== undefined);
        }

        const cleaned = {};
        for (const [key, item] of Object.entries(value)) {
            const cleanedItem = cleanNode(item, ancestors, depth + 1);
            if (cleanedItem === undefined) continue;
            if (!Array.isArray(cleanedItem) && typeof cleanedItem === 'object' && Object.keys(cleanedItem).length === 0) continue;
            cleaned[key] = cleanedItem;
        }
        return cleaned;
    } finally {
        ancestors.delete(value);
    }
}

function filterNodes(nodes) {
    if (nodes.length > MAX_SUBSCRIPTION_NODES) {
        throw new Error(`订阅节点不能超过 ${MAX_SUBSCRIPTION_NODES} 个`);
    }

    const filtered = [];
    for (const node of nodes) {
        if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
        const type = node.type || "unknown";
        if (ALLOWED_TYPES.has(type)) {
            filtered.push(cleanNode(node));
        }
    }
    return filtered;
}

/**
 * 单节点内容转换：支持 JSON 对象、分享链接（ss/vmess/vless/trojan/hy2/anytls）、YAML 片段。
 * 统一使用 js-yaml，支持数组（alpn: [h2]）与流式写法；输出为单行 JSON，名称以 nodeName 为准。
 */
function convertNode(content, nodeName = '') {
    const input = String(content || '').trim();
    if (!input) throw new Error('节点内容不能为空');

    let node = null;
    const uriNode = parseUriLine(input);
    if (uriNode) {
        node = uriNode;
    } else {
        let loaded;
        try {
            // JSON 是 YAML 的子集，js-yaml 可同时处理两者
            loaded = yaml.load(input.startsWith('- ') ? input.slice(2) : input);
        } catch (e) {
            throw new Error(`无法解析为 YAML/JSON: ${e.reason || e.message || e}`);
        }
        if (Array.isArray(loaded) && loaded.length === 1) loaded = loaded[0];
        if (loaded && typeof loaded === 'object' && !Array.isArray(loaded) && Array.isArray(loaded.proxies) && loaded.proxies.length === 1) {
            loaded = loaded.proxies[0];
        }
        if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
            throw new Error('内容不是单个节点对象');
        }
        node = loaded;
    }

    const cleaned = cleanNode(node);
    if (!cleaned || typeof cleaned !== 'object' || !cleaned.type || !cleaned.server) {
        throw new Error('节点缺少 type 或 server 字段');
    }
    if (nodeName) cleaned.name = nodeName;
    if (!cleaned.name) throw new Error('节点缺少名称');
    return JSON.stringify(cleaned);
}

// ====== [MODULE: 03_utils.js] ======
// ============================================================================
// 通用工具：随机串、YAML 标量引号、时间格式化、URL/IP 校验、安全比较
// ============================================================================

function stripOuterQuotes(value) {
    const text = String(value || '').trim();
    if (text.length >= 2) {
        const first = text[0];
        const last = text[text.length - 1];
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
            return text.slice(1, -1).trim();
        }
    }
    return text;
}

function utf8ByteLength(value) {
    return new TextEncoder().encode(String(value ?? '')).byteLength;
}

function formatServerTime(nowMs = Date.now()) {
    return new Date(nowMs).toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * 生成随机串。优先使用 crypto.getRandomValues，避免 Math.random 可预测问题。
 */
function generateRandomToken(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = new Uint8Array(length);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(bytes[i] % chars.length);
    }
    return result;
}

/** YAML 安全标量：统一使用 JSON 双引号转义，避免特殊字符破坏结构。 */
function yamlQuoteScalar(value) {
    return JSON.stringify(String(value ?? ''));
}

/** 由模板名派生确定性 ID，保证旧数据迁移后引用稳定。 */
function makeTemplateId(name) {
    const text = String(name || '').trim();
    if (!text) return `${TEMPLATE_ID_PREFIX}unnamed`;
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `${TEMPLATE_ID_PREFIX}${hash.toString(36)}`;
}

function isIPv4(value) {
    const text = String(value || '').trim();
    const parts = text.split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
        if (!/^\d{1,3}$/.test(part)) return false;
        const num = Number(part);
        return num >= 0 && num <= 255 && String(num) === part;
    });
}

function isIPv6(value) {
    const text = String(value || '').trim();
    if (!text.includes(':')) return false;
    if (!/^[0-9a-fA-F:.]+$/.test(text)) return false;
    if ((text.match(/::/g) || []).length > 1) return false;
    const sections = text.split('::');
    const head = sections[0] ? sections[0].split(':') : [];
    const tail = sections[1] ? sections[1].split(':') : [];
    const all = [...head, ...tail];
    if (sections.length === 1 && all.length !== 8) return false;
    if (sections.length === 2 && all.length > 7) return false;
    return all.every(group => group === '' || /^[0-9a-fA-F]{1,4}$/.test(group));
}

function isIPAddress(value) {
    return isIPv4(value) || isIPv6(value);
}

function normalizeIPValue(value) {
    return String(value || '').trim().toLowerCase();
}

function isValidHostDomain(value) {
    const text = String(value || '').trim();
    if (!text || text.length > 253) return false;
    // 允许通配前缀（*.example.com）与常见主机名/单标签域名。
    const candidate = text.startsWith('*.') ? text.slice(2) : text;
    return /^(?:[a-zA-Z0-9_](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?)(?:\.(?:[a-zA-Z0-9_](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?))*$/.test(candidate);
}

/** 常量时间比较，降低时序侧信道。 */
function timingSafeEqualString(a, b) {
    const strA = String(a ?? '');
    const strB = String(b ?? '');
    const len = Math.max(strA.length, strB.length);
    let diff = strA.length ^ strB.length;
    for (let i = 0; i < len; i++) {
        diff |= (strA.charCodeAt(i) || 0) ^ (strB.charCodeAt(i) || 0);
    }
    return diff === 0;
}

function parseCookies(cookieHeader = '') {
    const out = {};
    if (!cookieHeader) return out;
    for (const pair of String(cookieHeader).split(';')) {
        const idx = pair.indexOf('=');
        if (idx === -1) continue;
        const key = pair.slice(0, idx).trim();
        const val = pair.slice(idx + 1).trim();
        if (key) out[key] = val;
    }
    return out;
}

async function computeHmacHex(secret, message) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(`subpanel_hmac_v1:${secret}`),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function createSessionToken(adminPass, nowSec = Math.floor(Date.now() / 1000)) {
    const exp = nowSec + SESSION_MAX_AGE_SECONDS;
    const payload = `v1.${exp}`;
    const sig = await computeHmacHex(adminPass, payload);
    return `${payload}.${sig}`;
}

async function verifySessionToken(token, adminPass, nowSec = Math.floor(Date.now() / 1000)) {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') return false;
    const exp = Number(parts[1]);
    if (!Number.isFinite(exp) || exp < nowSec) return false;
    const expected = await computeHmacHex(adminPass, `v1.${parts[1]}`);
    return timingSafeEqualString(parts[2], expected);
}

// Secure 标记只在 HTTPS 下附加：Cloudflare 生产恒为 HTTPS，本地 http 调试时仍可写入 Cookie
function buildSessionCookie(token, secure = true) {
    return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

function buildClearedSessionCookie(secure = true) {
    return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=0`;
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json;charset=UTF-8', ...extraHeaders }
    });
}

// ====== [MODULE: 04_template_parser.js] ======
// ============================================================================
// 模板分析：解析 YAML 提取策略组名、rule-providers、规则区文本
// 说明：旧实现用逐行正则提取，遇到流式写法或键顺序变化会漏。这里统一走 js-yaml。
// ============================================================================

/**
 * 解析模板 YAML。失败返回 { ok:false, error }。
 * 只做结构校验，不修改原文——模板文本仍按原样拼接输出，避免格式漂移。
 */
function parseTemplateYaml(templateText) {
    const text = String(templateText || '');
    if (!text.trim()) {
        return { ok: false, error: '模板内容为空' };
    }
    let doc = null;
    try {
        doc = yaml.load(text);
    } catch (e) {
        return { ok: false, error: `模板 YAML 解析失败: ${e.message || e}` };
    }
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
        return { ok: false, error: '模板不是有效的 YAML 映射结构' };
    }
    if (!Array.isArray(doc['proxy-groups'])) {
        return { ok: false, error: '模板缺少 proxy-groups 数组' };
    }
    if (!Array.isArray(doc.rules)) {
        return { ok: false, error: '模板缺少 rules 数组' };
    }
    return { ok: true, doc };
}

/** 提取模板中定义的策略组名称（保持出现顺序、去重） */
function extractProxyGroupNames(templateText, parsed = null) {
    parsed = parsed || parseTemplateYaml(templateText);
    if (!parsed.ok) return [];
    const names = [];
    const seen = new Set();
    for (const group of parsed.doc['proxy-groups']) {
        if (!group || typeof group !== 'object') continue;
        const name = String(group.name ?? '').trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        names.push(name);
    }
    return names;
}

/** 提取模板中定义的 rule-providers 名称集合 */
function extractRuleProviderNames(templateText, parsed = null) {
    parsed = parsed || parseTemplateYaml(templateText);
    if (!parsed.ok) return [];
    const providers = parsed.doc['rule-providers'];
    if (!providers || typeof providers !== 'object' || Array.isArray(providers)) return [];
    return Object.keys(providers).map(key => String(key).trim()).filter(Boolean);
}

/** 汇总全部模板的策略组：allGroups 去重并集，groupsByTemplate 按模板 ID 分组 */
function collectTemplateGroups(templates = [], parsedByTemplate = {}) {
    const list = [];
    const seen = new Set();
    const byTemplateId = {};

    const pushGroups = (templateId, names) => {
        byTemplateId[templateId] = [...names];
        for (const name of names) {
            if (seen.has(name)) continue;
            seen.add(name);
            list.push(name);
        }
    };

    for (const tpl of Array.isArray(templates) ? templates : []) {
        if (!tpl || !tpl.id) continue;
        const parsed = parseTemplateYaml(tpl.content || '');
        parsedByTemplate[tpl.id] = parsed;
        pushGroups(tpl.id, extractProxyGroupNames(tpl.content || '', parsed));
    }

    return { allGroups: list, groupsByTemplate: byTemplateId };
}

/**
 * 定位模板中 rules: 区块的行范围，用于在顶部插入附加规则。
 * 返回 { start, end }（end 为区块结束行号，不含），找不到返回 null。
 */
function locateRulesBlock(templateText) {
    const lines = String(templateText || '').split('\n');
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        if (/^rules\s*:\s*(?:#.*)?$/.test(lines[i])) {
            start = i;
            break;
        }
    }
    if (start === -1) return null;

    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
        const raw = lines[i];
        const trimmed = raw.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('#')) continue;
        // 顶层键（无缩进）即区块结束
        if (/^\S/.test(raw)) {
            end = i;
            break;
        }
    }
    return { start, end };
}

/**
 * 规则行通常可以直接写成 YAML 纯标量；但策略组名含 ": "、" #" 或以特殊字符开头时
 * 会破坏 YAML 结构，此时改用双引号标量。
 */
function yamlSafeRuleScalar(line) {
    const text = String(line);
    if (/:\s|\s#|:$|^[\s'"&*!|>%@`{\[\]#?-]/.test(text)) {
        return JSON.stringify(text);
    }
    return text;
}

/**
 * 在模板中合并一个顶层块（proxies / proxy-providers）。
 * 模板已有同名顶层键时把条目插到其下（沿用原缩进），否则追加新块，避免产生重复键。
 * entryLines 以两个空格为基准缩进。
 * @param {string} templateText
 * @param {string} key
 * @param {string[]} [entryLines]
 */
function mergeTopLevelBlock(templateText, key, entryLines = []) {
    const text = String(templateText || '');
    if (!Array.isArray(entryLines) || entryLines.length === 0) return { content: text };

    const lines = text.split('\n');
    const keyRe = new RegExp(`^${key}\\s*:(.*)$`);
    const keyIndex = lines.findIndex(line => keyRe.test(line));

    if (keyIndex === -1) {
        const base = text.replace(/\s+$/, '');
        return { content: `${base}\n\n${key}:\n${entryLines.join('\n')}\n` };
    }

    const rest = lines[keyIndex].match(keyRe)[1].replace(/\s+#.*$/, '').trim();
    if (rest && rest !== '[]' && rest !== '{}' && rest !== '~' && rest !== 'null') {
        return { error: `模板中的 ${key} 使用了行内写法，无法自动合并，请改为块写法` };
    }

    // 探测已有子项缩进，保持一致
    let indent = '  ';
    for (let i = keyIndex + 1; i < lines.length; i++) {
        const raw = lines[i];
        const trimmed = raw.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        if (/^\S/.test(raw) && !raw.startsWith('-')) break;
        indent = raw.match(/^(\s*)/)[1];
        break;
    }
    const adjusted = entryLines.map(line => indent + line.slice(2));

    lines[keyIndex] = `${key}:`;
    lines.splice(keyIndex + 1, 0, ...adjusted);
    return { content: lines.join('\n') };
}

/**
 * 把附加规则插入到 rules: 区块顶部（Mihomo 按顺序匹配，附加规则优先）。
 * 复用模板原有缩进风格。
 */
function insertRulesIntoBlock(templateText, ruleLines = []) {
    if (!Array.isArray(ruleLines) || ruleLines.length === 0) {
        return { content: String(templateText || '') };
    }
    const block = locateRulesBlock(templateText);
    if (!block) {
        return { error: '模板缺少 rules: 区块，无法附加规则' };
    }

    const lines = String(templateText || '').split('\n');
    // 检测原有条目的缩进（默认两个空格）
    let indent = '  ';
    for (let i = block.start + 1; i < block.end; i++) {
        const match = lines[i].match(/^(\s+)-\s/);
        if (match) {
            indent = match[1];
            break;
        }
    }

    const inserted = ruleLines.map(rule => `${indent}- ${yamlSafeRuleScalar(rule)}`);
    lines.splice(block.start + 1, 0, ...inserted);
    return { content: lines.join('\n') };
}

// ====== [MODULE: 05_rules_model.js] ======
// ============================================================================
// 规则附加：逐条结构化规则模型、校验、按模板筛选
// 数据结构：
//   { revision:number, rules:[{ id, target, type, info, policy, noResolve, prevPolicy? }] }
//   target 为 'global' 或模板 ID（稳定 ID，模板改名不失效）
//   rules 的数组顺序即全部规则的统一排序；生成某个配置时跳过指定给其他模板的规则，
//   其余按原顺序插入模板 rules 顶部。
// ============================================================================

function makeRuleId() {
    return `r_${generateRandomToken(12)}`;
}

/** 规范化单条规则；target 自动归一为 'global' 或模板 ID 字符串 */
function normalizeRuleItem(item = {}) {
    const type = String(item.type || '').trim().toUpperCase();
    const info = String(item.info ?? item.value ?? '').trim();
    const policy = String(item.policy ?? '').trim() || RULE_DISABLED_POLICY;
    const target = String(item.target ?? RULE_TARGET_GLOBAL).trim() || RULE_TARGET_GLOBAL;
    const noResolve = RULE_NO_RESOLVE_TYPES.has(type) ? !!item.noResolve : false;
    const rawId = String(item.id || '').trim();
    const rule = {
        id: RULE_ID_PATTERN.test(rawId) ? rawId : makeRuleId(),
        target,
        type,
        info,
        policy,
        noResolve
    };
    // 停用（NULL）时记住原策略，便于一键恢复
    const prevPolicy = String(item.prevPolicy || '').trim();
    if (policy === RULE_DISABLED_POLICY && prevPolicy && prevPolicy !== RULE_DISABLED_POLICY) {
        rule.prevPolicy = prevPolicy;
    }
    return rule;
}

/** 规则内容是否相同（忽略 id），用于判断某条规则是否被修改过 */
function isSameRuleContent(a, b) {
    return !!a && !!b
        && a.target === b.target
        && a.type === b.type
        && a.info === b.info
        && a.policy === b.policy
        && !!a.noResolve === !!b.noResolve;
}

/** 把规则对象序列化成一条 Mihomo 规则文本 */
function formatRuleLine(rule) {
    const base = `${rule.type},${rule.info},${rule.policy}`;
    if (rule.noResolve && RULE_NO_RESOLVE_TYPES.has(rule.type)) {
        return `${base},no-resolve`;
    }
    return base;
}

/**
 * 解析历史多行文本规则（旧版 KV 数据迁移用）。
 * 兼容 IPCIDR 写法，注释与空行忽略，无法识别的行写入 invalid。
 */
function parseRulesFromText(content, defaultTarget = RULE_TARGET_GLOBAL) {
    const rules = [];
    const invalid = [];
    const lines = String(content || '').split(/\r?\n/);

    lines.forEach((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) return;

        const parts = line.split(',').map(part => part.trim());
        if (parts.length < 3) {
            invalid.push({ lineNo: idx + 1, line });
            return;
        }

        let type = parts[0].toUpperCase();
        // 兼容旧写法：IPCIDR -> IP-CIDR
        if (type === 'IPCIDR') type = 'IP-CIDR';

        if (!RULE_TYPES.includes(type)) {
            invalid.push({ lineNo: idx + 1, line });
            return;
        }

        const modifier = parts[3] ? parts[3].toLowerCase() : '';
        rules.push(normalizeRuleItem({
            target: defaultTarget,
            type,
            info: parts[1],
            policy: parts[2],
            noResolve: modifier === 'no-resolve'
        }));
    });

    return { rules, invalid };
}

/**
 * 规范化规则附加配置。
 * - 优先使用结构化 rules 数组
 * - 旧数据只有 content 文本时自动拆解为逐条规则，target 使用 config.templateId（迁移时由存储层解析）
 * - 规则 ID 去重，保证暂存/统一保存时能可靠对应
 */
function normalizeRuleAppendConfig(config = {}) {
    let rules = [];
    if (Array.isArray(config.rules) && config.rules.length > 0) {
        rules = config.rules.map(item => normalizeRuleItem(item));
    } else if (typeof config.content === 'string' && config.content.trim()) {
        const legacyTarget = String(config.templateId || RULE_TARGET_GLOBAL).trim() || RULE_TARGET_GLOBAL;
        rules = parseRulesFromText(config.content, legacyTarget).rules;
    }

    const usedIds = new Set();
    for (const rule of rules) {
        while (usedIds.has(rule.id)) rule.id = makeRuleId();
        usedIds.add(rule.id);
    }

    if (rules.length > MAX_RULE_ITEMS) {
        rules = rules.slice(0, MAX_RULE_ITEMS);
    }

    return {
        enabled: !!config.enabled,
        revision: Number.isFinite(Number(config.revision)) ? Number(config.revision) : 0,
        rules,
        updatedAt: String(config.updatedAt || '')
    };
}

/** 校验单条规则的结构（类型、内容、策略非空），不检查策略组是否存在 */
function validateRuleStructure(item) {
    const type = String(item.type || '').trim().toUpperCase();
    const info = String(item.info || '').trim();
    const policy = String(item.policy || '').trim();

    if (!RULE_TYPES.includes(type)) {
        return `不支持的规则类型：${type || '(空)'}`;
    }
    if (!info) {
        return '匹配内容不能为空';
    }
    // 规则以逗号分隔，内容中出现逗号/空白会破坏解析（DOMAIN-REGEX 的反斜杠是合法的）
    if (/[\s,]/.test(info)) {
        return '匹配内容不能包含空格或逗号';
    }
    if ((type === 'DST-PORT' || type === 'SRC-PORT') && !/^\d+(?:[-/]\d+)*$/.test(info)) {
        return '端口格式应为数字，例如 443 或 8000-9000';
    }
    if (!policy) {
        return '策略组不能为空';
    }
    return '';
}

/**
 * 整体保存时校验全部规则。
 * - 所有规则都做结构校验
 * - 只有新增或内容被修改的规则才检查 target 与策略组是否存在：
 *   未改动的旧规则即便模板后来变化导致失效，也不应阻止用户保存其他修改
 *   （这类规则合成时会被自动跳过，界面上也会标出）。
 * 返回 { ok, rules, errors:[{ index, id, error }] }
 */
function validateRuleSet(rawRules, storedRules, catalog) {
    const errors = [];
    if (!Array.isArray(rawRules)) {
        return { ok: false, rules: [], errors: [{ index: -1, id: '', error: '规则列表格式无效' }] };
    }
    if (rawRules.length > MAX_RULE_ITEMS) {
        return { ok: false, rules: [], errors: [{ index: -1, id: '', error: `规则最多 ${MAX_RULE_ITEMS} 条` }] };
    }

    const storedById = new Map((storedRules || []).map(rule => [rule.id, rule]));
    const templateIds = new Set(catalog.templates.map(t => t.id));
    const globalPolicies = new Set([...RULE_BUILTIN_POLICIES, ...catalog.allGroups]);

    const rules = rawRules.map((raw, index) => {
        const rule = normalizeRuleItem(raw || {});
        const structureError = validateRuleStructure(rule);
        if (structureError) {
            errors.push({ index, id: rule.id, error: structureError });
            return rule;
        }

        const stored = storedById.get(rule.id);
        if (stored && isSameRuleContent(stored, rule)) return rule;

        if (rule.target !== RULE_TARGET_GLOBAL && !templateIds.has(rule.target)) {
            errors.push({ index, id: rule.id, error: '目标模板不存在' });
            return rule;
        }
        if (rule.policy !== RULE_DISABLED_POLICY) {
            const allowed = rule.target === RULE_TARGET_GLOBAL
                ? globalPolicies
                : new Set([...RULE_BUILTIN_POLICIES, ...(catalog.groupsByTemplate[rule.target] || [])]);
            if (!allowed.has(rule.policy)) {
                errors.push({ index, id: rule.id, error: `策略组「${rule.policy}」不存在` });
            }
        }
        return rule;
    });

    return { ok: errors.length === 0, rules, errors };
}

/**
 * 为指定模板筛出可生效的附加规则。
 * 跳过条件：目标不匹配、策略为 NULL、策略组在目标模板中不存在、RULE-SET provider 缺失。
 * 返回 { activeLines, skipped }
 */
function resolveRulesForTemplate(ruleConfig, templateId, templateText, parsedTemplate = null) {
    const normalized = normalizeRuleAppendConfig(ruleConfig);
    const parsed = parsedTemplate || parseTemplateYaml(templateText);
    const groupNames = extractProxyGroupNames(templateText, parsed);
    const providerNames = new Set(extractRuleProviderNames(templateText, parsed));
    const validPolicies = new Set([...RULE_BUILTIN_POLICIES, ...groupNames]);

    const activeLines = [];
    const skipped = [];
    const usedLines = new Set();

    for (const raw of normalized.rules) {
        if (!raw.type || !raw.info || !raw.policy) continue;
        if (raw.target !== RULE_TARGET_GLOBAL && raw.target !== templateId) continue;
        if (raw.policy === RULE_DISABLED_POLICY) continue;

        if (!validPolicies.has(raw.policy)) {
            skipped.push({ rule: raw, reason: `目标模板中没有策略组「${raw.policy}」，已跳过` });
            continue;
        }

        // RULE-SET 引用的 provider 必须存在，否则 Mihomo 加载会失败
        if (raw.type === 'RULE-SET' && !providerNames.has(raw.info)) {
            skipped.push({ rule: raw, reason: `目标模板中没有 rule-provider「${raw.info}」，已跳过` });
            continue;
        }

        const line = formatRuleLine(raw);
        if (usedLines.has(line)) continue;
        usedLines.add(line);
        activeLines.push(line);
    }

    return { activeLines, skipped };
}

// ====== [MODULE: 06_hosts_model.js] ======
// ============================================================================
// Hosts 附加：订阅源解析、静态内容校验、双栈筛选与 YAML 区块合并
// ============================================================================

/** 规范化单条 hosts 记录 */
function normalizeHostsEntry(entry) {
    if (!entry || typeof entry.domain !== 'string' || !Array.isArray(entry.ips)) return null;
    const domain = entry.domain.trim();
    const ips = Array.from(new Set(entry.ips.map(ip => String(ip).trim()).filter(Boolean)));
    if (!domain || ips.length === 0) return null;
    return { domain, ips };
}

/** 生成一行 Mihomo hosts 配置 */
function formatHostsLine(domain, ips) {
    const quoted = ips.map(ip => JSON.stringify(ip)).join(', ');
    return `${yamlQuoteScalar(domain)}: [${quoted}]`;
}

/** 按 all / ipv4 / ipv6 过滤 hosts 条目 */
function filterHostsEntries(entries = [], ipFilter = 'all') {
    const out = [];
    for (const raw of Array.isArray(entries) ? entries : []) {
        const entry = normalizeHostsEntry(raw);
        if (!entry) continue;
        const ips = entry.ips.filter(ip => {
            if (ipFilter === 'ipv4') return isIPv4(ip);
            if (ipFilter === 'ipv6') return isIPv6(ip);
            return isIPAddress(ip) || isValidHostDomain(ip);
        });
        if (ips.length > 0) out.push({ domain: entry.domain, ips });
    }
    return out;
}

/**
 * 解析上游 hosts 订阅文本。
 * 同时支持 "IP 域名..." 与 "域名 IP..." 两种行格式，以及 # 注释与 hosts 文件常见写法。
 */
function parseHostsSubscription(rawText) {
    const text = String(rawText || '');
    if (!text.trim()) return { ok: false, error: 'Hosts 订阅内容为空', entries: [] };
    if (utf8ByteLength(text) > MAX_SUBSCRIPTION_INPUT_BYTES) {
        return { ok: false, error: 'Hosts 订阅内容超过 2 MiB 限制', entries: [] };
    }

    const domainMap = new Map();
    const addMapping = (domain, ip) => {
        if (!domainMap.has(domain)) domainMap.set(domain, new Set());
        domainMap.get(domain).add(normalizeIPValue(ip));
    };

    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.replace(/#.*$/, '').trim();
        if (!line) continue;
        const tokens = line.split(/\s+/).filter(Boolean);
        if (tokens.length < 2) continue;

        if (isIPAddress(tokens[0])) {
            const ip = normalizeIPValue(tokens[0]);
            for (let i = 1; i < tokens.length; i++) {
                const candidate = stripOuterQuotes(tokens[i]);
                if (isValidHostDomain(candidate)) addMapping(candidate, ip);
            }
        } else {
            const domain = stripOuterQuotes(tokens[0]);
            if (!isValidHostDomain(domain)) continue;
            for (let i = 1; i < tokens.length; i++) {
                const ip = stripOuterQuotes(tokens[i]);
                if (isIPAddress(ip)) addMapping(domain, ip);
            }
        }
    }

    const entries = Array.from(domainMap.entries()).map(([domain, ipSet]) => ({
        domain,
        ips: Array.from(ipSet)
    }));
    if (entries.length === 0) {
        return { ok: false, error: '未解析到有效的 Hosts 映射记录', entries: [] };
    }
    if (entries.length > MAX_HOSTS_ENTRIES) {
        return {
            ok: false,
            error: `订阅内容超长（共 ${entries.length} 条，上限 ${MAX_HOSTS_ENTRIES}），无法添加`,
            entries: []
        };
    }
    return { ok: true, entries };
}

/** 校验静态 Hosts 文本，返回规范化文本与错误列表 */
function validateStaticHostsContent(content) {
    const errors = [];
    const normalizedLines = [];
    const entries = [];
    const seen = new Set();

    String(content || '').split(/\r?\n/).forEach((rawLine, index) => {
        const lineNo = index + 1;
        const trimmed = rawLine.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        // 兼容两种写法：domain: [ip1, ip2]  与  domain: ip1, ip2
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx === -1) {
            errors.push(`第 ${lineNo} 行格式错误：缺少冒号分隔符`);
            return;
        }

        const domain = stripOuterQuotes(trimmed.slice(0, colonIdx));
        if (!isValidHostDomain(domain)) {
            errors.push(`第 ${lineNo} 行域名格式无效`);
            return;
        }
        if (seen.has(domain)) {
            errors.push(`第 ${lineNo} 行域名「${domain}」重复`);
            return;
        }

        let valuePart = trimmed.slice(colonIdx + 1).trim();
        // 去掉行尾注释
        valuePart = valuePart.replace(/\s+#.*$/, '').trim();
        if (valuePart.startsWith('[') && valuePart.endsWith(']')) {
            valuePart = valuePart.slice(1, -1).trim();
        }
        if (!valuePart) {
            errors.push(`第 ${lineNo} 行 IP 列表不能为空`);
            return;
        }

        const ips = [];
        for (const rawItem of valuePart.split(',')) {
            const val = stripOuterQuotes(rawItem);
            if (!val) {
                errors.push(`第 ${lineNo} 行存在空的列表项`);
                return;
            }
            if (!isIPAddress(val)) {
                errors.push(`第 ${lineNo} 行「${val}」不是有效 IP 地址`);
                return;
            }
            const normalized = normalizeIPValue(val);
            if (!ips.includes(normalized)) ips.push(normalized);
        }

        seen.add(domain);
        entries.push({ domain, ips });
        normalizedLines.push(formatHostsLine(domain, ips));
    });

    if (entries.length > MAX_HOSTS_ENTRIES) {
        errors.unshift(`静态 Hosts 超过 ${MAX_HOSTS_ENTRIES} 条上限（当前 ${entries.length} 条）`);
    }

    return { ok: errors.length === 0, errors, normalizedContent: normalizedLines.join('\n'), entries };
}

/** 规范化单个 hosts 订阅源 */
function normalizeHostsSub(sub = {}) {
    const entries = Array.isArray(sub.entries)
        ? sub.entries.map(normalizeHostsEntry).filter(Boolean)
        : [];
    return {
        name: String(sub.name || '').trim(),
        url: String(sub.url || '').trim(),
        autoUpdate: !!sub.autoUpdate,
        entries,
        updatedAt: String(sub.updatedAt || ''),
        updatedAtMs: Number.isFinite(Number(sub.updatedAtMs)) ? Number(sub.updatedAtMs) : 0,
        lastAttemptAtMs: Number.isFinite(Number(sub.lastAttemptAtMs)) ? Number(sub.lastAttemptAtMs) : 0,
        lastError: String(sub.lastError || '')
    };
}

/** 规范化 hosts 附加配置 */
function normalizeHostsAppendConfig(config = {}) {
    const subs = Array.isArray(config.subs)
        ? config.subs.map(normalizeHostsSub).filter(sub => sub.name && sub.url).slice(0, MAX_HOSTS_SUBS)
        : [];
    return {
        revision: Number(config.revision) || 0,
        ipFilter: HOSTS_IP_FILTERS.includes(config.ipFilter) ? config.ipFilter : 'all',
        subs,
        staticContent: String(config.staticContent || ''),
        updatedAt: String(config.updatedAt || '')
    };
}

/** 合并订阅条目与静态条目（静态优先覆盖同域名） */
function buildMergedHostsEntries(config = {}) {
    const normalized = normalizeHostsAppendConfig(config);
    const merged = new Map();

    for (const sub of normalized.subs) {
        for (const entry of filterHostsEntries(sub.entries, normalized.ipFilter)) {
            if (!merged.has(entry.domain)) {
                merged.set(entry.domain, [...entry.ips]);
            } else {
                const existing = merged.get(entry.domain);
                for (const ip of entry.ips) {
                    if (!existing.includes(ip)) existing.push(ip);
                }
            }
        }
    }

    const staticValidation = validateStaticHostsContent(normalized.staticContent);
    if (staticValidation.ok) {
        for (const entry of staticValidation.entries) {
            merged.set(entry.domain, [...entry.ips]);
        }
    }

    return Array.from(merged.entries()).map(([domain, ips]) => ({ domain, ips }));
}

/**
 * 将 hosts 条目合并进模板 YAML 文本的 hosts: 区块。
 * 已有同域名条目会被替换，其余保留原位置。
 */
function mergeHostsIntoTemplate(templateText, hostEntries = []) {
    const text = String(templateText || '');
    const entries = (Array.isArray(hostEntries) ? hostEntries : [])
        .map(normalizeHostsEntry)
        .filter(Boolean);
    if (entries.length === 0) return { content: text };

    const appendMap = new Map();
    for (const entry of entries) {
        appendMap.set(entry.domain, formatHostsLine(entry.domain, entry.ips));
    }

    const lines = text.split('\n');
    const hostsIndex = lines.findIndex(line => /^hosts\s*:\s*(?:#.*)?$/.test(line));
    const insertedLines = Array.from(appendMap.values()).map(line => `  ${line}`);

    if (hostsIndex !== -1) {
        let blockEnd = lines.length;
        for (let i = hostsIndex + 1; i < lines.length; i++) {
            const raw = lines[i];
            const trimmed = raw.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            if (/^\S/.test(raw)) {
                blockEnd = i;
                break;
            }
        }

        // 移除已被覆盖的同域名行，保留其余行与空行
        const kept = [];
        for (let i = hostsIndex + 1; i < blockEnd; i++) {
            const line = lines[i];
            const keyMatch = line.match(/^\s+("[^"]*"|'[^']*'|[^:#\s]+)\s*:/);
            if (keyMatch) {
                const domain = stripOuterQuotes(keyMatch[1]);
                if (appendMap.has(domain)) continue;
            }
            kept.push(line);
        }

        // 去掉尾部空行再拼回，避免累积空行
        while (kept.length > 0 && !kept[kept.length - 1].trim()) kept.pop();
        lines.splice(hostsIndex + 1, blockEnd - (hostsIndex + 1), ...insertedLines, ...kept);
        return { content: lines.join('\n') };
    }

    // 模板没有 hosts 区块：插到 proxy-groups/rules 之前
    const anchor = lines.findIndex(line => /^(?:proxy-groups|rules)\s*:\s*(?:#.*)?$/.test(line));
    const block = ['hosts:', ...insertedLines, ''];
    if (anchor !== -1) {
        lines.splice(anchor, 0, ...block);
    } else {
        lines.push('', ...block);
    }
    return { content: lines.join('\n') };
}

/** 面向前端的 Hosts 配置视图：订阅条目只给数量，避免把上万条域名回传浏览器 */
function presentHostsConfig(config = {}) {
    const normalized = normalizeHostsAppendConfig(config);
    return {
        ipFilter: normalized.ipFilter,
        staticContent: normalized.staticContent,
        updatedAt: normalized.updatedAt,
        mergedCount: buildMergedHostsEntries(normalized).length,
        maxEntries: MAX_HOSTS_ENTRIES,
        subs: normalized.subs.map(sub => ({
            name: sub.name,
            url: sub.url,
            autoUpdate: sub.autoUpdate,
            updatedAt: sub.updatedAt,
            lastError: sub.lastError,
            entryCount: sub.entries.length
        }))
    };
}

// ====== [MODULE: 07_storage.js] ======
// ============================================================================
// KV 存储层：订阅、节点、模板（含稳定 ID 迁移）、输出配置、规则与 Hosts 配置
// ============================================================================

/** KV 同键写入可能被限流；只对 429 做有限退避。函数值在每次重试时重新读取并合并。 */
async function kvPut(env, key, value) {
    for (let attempt = 0; ; attempt++) {
        try {
            const nextValue = typeof value === 'function' ? await value() : value;
            if (nextValue === undefined) return;
            await env.SUBPANEL_KV.put(key, nextValue);
            return;
        } catch (e) {
            if (attempt >= 2 || !/\b429\b|Too Many Requests/i.test(String(e && e.message || e))) throw e;
            await new Promise(resolve => setTimeout(resolve, 1100 * (attempt + 1)));
        }
    }
}

function reportBackgroundError(task, error) {
    console.error(`[SubPanel] ${task}失败`, error);
}

async function readJsonArray(env, key) {
    const raw = await env.SUBPANEL_KV.get(key);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

async function writeJsonArray(env, key, list) {
    await kvPut(env, key, JSON.stringify(Array.isArray(list) ? list : []));
    return Array.isArray(list) ? list : [];
}

// ====== 订阅 ======
function normalizeSub(sub = {}) {
    return {
        name: String(sub.name || '').trim(),
        url: String(sub.url || '').trim(),
        useProvider: sub.useProvider !== false,
        autoUpdate: !!sub.autoUpdate,
        lastUpdate: sub.lastUpdate || null,
        nodeCount: Number.isFinite(Number(sub.nodeCount)) ? Number(sub.nodeCount) : 0,
        lastSource: String(sub.lastSource || '')
    };
}

async function readSubs(env) {
    const list = await readJsonArray(env, KV_KEY_SUBS);
    return list.map(normalizeSub).filter(sub => sub.name && sub.url);
}

async function writeSubs(env, subs) {
    const list = (Array.isArray(subs) ? subs : []).map(normalizeSub).filter(sub => sub.name && sub.url);
    return await writeJsonArray(env, KV_KEY_SUBS, list);
}

// ====== 单节点 ======
function normalizeManualNode(node = {}) {
    return {
        name: String(node.name || '').trim(),
        content: String(node.content || '')
    };
}

async function readNodes(env) {
    const list = await readJsonArray(env, KV_KEY_NODES);
    return list.map(normalizeManualNode).filter(node => node.name && node.content);
}

async function writeNodes(env, nodes) {
    const list = (Array.isArray(nodes) ? nodes : []).map(normalizeManualNode).filter(node => node.name && node.content);
    return await writeJsonArray(env, KV_KEY_NODES, list);
}

// ====== 模板（稳定 ID） ======
async function kvDelete(env, key) {
    if (typeof env.SUBPANEL_KV.delete === 'function') {
        await env.SUBPANEL_KV.delete(key);
    }
}

/**
 * 规范化自定义模板列表。
 * 旧数据没有 id 字段，按名称派生确定性 ID 并回写，使规则引用在迁移后保持稳定。
 * 不在这里截断数量：迁移旧默认模板时允许暂时超过上限，由新增接口限制数量。
 * 返回 { templates, changed }
 */
function normalizeTemplates(list = []) {
    const usedIds = new Set();
    const seenNames = new Set();
    const out = [];
    let changed = false;

    for (const raw of Array.isArray(list) ? list : []) {
        if (!raw || typeof raw !== 'object') continue;
        const name = String(raw.name || '').trim();
        if (!name || seenNames.has(name)) {
            changed = true;
            continue;
        }

        let id = String(raw.id || '').trim();
        if (!id || !id.startsWith(TEMPLATE_ID_PREFIX) || usedIds.has(id)) {
            const base = makeTemplateId(name);
            id = base;
            let suffix = 2;
            while (usedIds.has(id)) {
                id = `${base}_${suffix}`;
                suffix++;
            }
        }
        if (id !== raw.id) changed = true;

        usedIds.add(id);
        seenNames.add(name);
        out.push({
            id,
            name,
            type: raw.type === 'url' ? 'url' : 'txt',
            url: String(raw.url || ''),
            content: String(raw.content || ''),
            updatedAt: String(raw.updatedAt || '')
        });
    }
    return { templates: out, changed };
}

/**
 * 读取模板列表。
 * 一次性迁移：旧版内置默认模板（KV 键 template0）若有内容，转为普通模板
 * 「默认模板（迁移）」，固定 ID 为 MIGRATED_DEFAULT_TEMPLATE_ID；之后删除旧键。
 * 引用旧默认模板的输出配置与规则，在各自读取时解析到这个新 ID。
 */
async function readTemplates(env) {
    const [raw, legacyDefault] = await Promise.all([
        readJsonArray(env, KV_KEY_TEMPLATES),
        env.SUBPANEL_KV.get(KV_KEY_LEGACY_DEFAULT_TEMPLATE)
    ]);

    let list = raw;
    let migrated = false;
    if (legacyDefault !== null && legacyDefault !== undefined) {
        const alreadyMigrated = raw.some(t => t && t.id === MIGRATED_DEFAULT_TEMPLATE_ID);
        if (String(legacyDefault).trim() && !alreadyMigrated) {
            const usedNames = new Set(raw.map(t => t && String(t.name || '').trim()));
            let name = MIGRATED_DEFAULT_TEMPLATE_NAME;
            let suffix = 2;
            while (usedNames.has(name)) {
                name = `${MIGRATED_DEFAULT_TEMPLATE_NAME} ${suffix}`;
                suffix++;
            }
            list = [{
                id: MIGRATED_DEFAULT_TEMPLATE_ID,
                name,
                type: 'txt',
                url: '',
                content: String(legacyDefault),
                updatedAt: formatServerTime()
            }, ...raw];
        }
        migrated = true;
    }

    const { templates, changed } = normalizeTemplates(list);
    if (changed || migrated) {
        await writeJsonArray(env, KV_KEY_TEMPLATES, templates);
    }
    if (migrated) {
        await kvDelete(env, KV_KEY_LEGACY_DEFAULT_TEMPLATE);
        await kvDelete(env, KV_KEY_LEGACY_DEFAULT_TEMPLATE_META);
    }
    return templates;
}

async function writeTemplates(env, templates) {
    const { templates: normalized } = normalizeTemplates(templates);
    return await writeJsonArray(env, KV_KEY_TEMPLATES, normalized);
}

/** 模板列表 + 策略组汇总（供下拉框与校验使用） */
async function readTemplateCatalog(env) {
    const templates = await readTemplates(env);
    const parsedByTemplate = {};
    const { allGroups, groupsByTemplate } = collectTemplateGroups(templates, parsedByTemplate);
    return { templates, allGroups, groupsByTemplate, parsedByTemplate };
}

/** 按 ID 取模板文本 */
async function getTemplateContentById(env, templateId, templateCatalog = null) {
    if (!templateId) {
        return { error: '尚未选择模板' };
    }
    const catalog = templateCatalog || await readTemplateCatalog(env);
    const tpl = catalog.templates.find(t => t.id === templateId);
    if (!tpl || !tpl.content) {
        return { error: '模板不存在或已被删除，请重新选择模板' };
    }
    return { content: tpl.content, template: tpl };
}

/**
 * 把旧版模板引用（模板名 / 'template0' / '默认模板'）解析为模板 ID。
 * 旧默认模板：已迁移则指向迁移后的模板，否则保留 'template0'（视为已删除的模板）。
 */
function resolveLegacyTemplateRef(ref, templates) {
    const text = String(ref || '').trim();
    if (text === RULE_TARGET_GLOBAL) return RULE_TARGET_GLOBAL;
    if (!text || text === LEGACY_DEFAULT_TEMPLATE_ID || text === '默认模板') {
        return templates.some(t => t.id === MIGRATED_DEFAULT_TEMPLATE_ID)
            ? MIGRATED_DEFAULT_TEMPLATE_ID
            : LEGACY_DEFAULT_TEMPLATE_ID;
    }
    const byId = templates.find(t => t.id === text);
    if (byId) return byId.id;
    const byName = templates.find(t => t.name === text);
    return byName ? byName.id : text;
}

// ====== 规则附加配置 ======
/**
 * 读取规则附加配置。
 * 旧版本数据形如 { templateName, enabled, content }：规则绑定在单一模板上。
 * 迁移时把每条规则的 target 设为原绑定模板的稳定 ID（输出与升级前一致），
 * 并立即回写：否则每次读取都会生成新的随机规则 ID，导致暂存/保存无法对应。
 */
async function readRuleAppendConfig(env) {
    const raw = await env.SUBPANEL_KV.get(KV_KEY_RULE_APPEND);
    if (!raw) return normalizeRuleAppendConfig();

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        return normalizeRuleAppendConfig();
    }
    if (!parsed || typeof parsed !== 'object') return normalizeRuleAppendConfig();

    const hasStructured = Array.isArray(parsed.rules) && parsed.rules.length > 0;
    const needsIds = hasStructured && parsed.rules.some(rule => !rule || !RULE_ID_PATTERN.test(String(rule.id || '')));
    const isLegacyText = !hasStructured && typeof parsed.content === 'string' && parsed.content.trim();
    const hasLegacyTargets = hasStructured && parsed.rules.some(rule => rule && rule.target
        && rule.target !== RULE_TARGET_GLOBAL
        && !String(rule.target).startsWith(TEMPLATE_ID_PREFIX));

    if (!needsIds && !isLegacyText && !hasLegacyTargets) {
        return normalizeRuleAppendConfig(parsed);
    }

    const templates = await readTemplates(env);
    const source = { ...parsed };
    if (isLegacyText) {
        source.templateId = resolveLegacyTemplateRef(parsed.templateId || parsed.templateName, templates);
    }
    if (hasStructured) {
        source.rules = parsed.rules.map(rule => ({
            ...rule,
            target: resolveLegacyTemplateRef(rule && rule.target, templates)
        }));
    }

    const migrated = normalizeRuleAppendConfig(source);
    // 无法解析的旧引用（例如已不存在的默认模板）保持原样时不重复写入
    if (needsIds || isLegacyText || JSON.stringify(migrated) !== JSON.stringify(normalizeRuleAppendConfig(parsed))) {
        await kvPut(env, KV_KEY_RULE_APPEND, JSON.stringify(migrated));
    }
    return migrated;
}

/** 写入规则配置；每次写入 revision 递增，用于整体保存时检测并发修改 */
async function writeRuleAppendConfig(env, config) {
    const normalized = normalizeRuleAppendConfig({
        ...config,
        revision: (Number(config.revision) || 0) + 1,
        updatedAt: formatServerTime()
    });
    await kvPut(env, KV_KEY_RULE_APPEND, JSON.stringify(normalized));
    return normalized;
}

// ====== Hosts 附加配置 ======
async function readHostsAppendConfig(env) {
    const raw = await env.SUBPANEL_KV.get(KV_KEY_HOSTS_APPEND);
    if (!raw) return normalizeHostsAppendConfig();
    try {
        return normalizeHostsAppendConfig(JSON.parse(raw));
    } catch (e) {
        return normalizeHostsAppendConfig();
    }
}

async function writeHostsAppendConfig(env, config) {
    let normalized;
    await kvPut(env, KV_KEY_HOSTS_APPEND, async () => {
        const source = typeof config === 'function' ? await config(await readHostsAppendConfig(env)) : config;
        normalized = normalizeHostsAppendConfig({ ...source, updatedAt: formatServerTime() });
        return JSON.stringify(normalized);
    });
    return normalized;
}

// ====== 输出配置 ======
function normalizeOutputConfig(item = {}, index = 0, usedIds = new Set(), usedTokens = new Set()) {
    let id = String(item.id || '').trim();
    if (!id || usedIds.has(id)) {
        let seq = index + 1;
        while (usedIds.has(`cfg_${seq}`)) seq++;
        id = `cfg_${seq}`;
    }
    usedIds.add(id);

    const fallbackName = `配置 ${index + 1}`;
    const name = String(item.name || '').trim() || fallbackName;

    let token = String(item.token || '').trim();
    if (!token || usedTokens.has(token)) {
        do {
            token = generateRandomToken(16);
        } while (usedTokens.has(token));
    }
    usedTokens.add(token);

    const toStringArray = (value) => Array.isArray(value)
        ? Array.from(new Set(value.map(v => String(v || '').trim()).filter(Boolean)))
        : [];

    return {
        id,
        name,
        token,
        subNames: toStringArray(item.subNames),
        nodeNames: toStringArray(item.nodeNames),
        // 允许为空：表示尚未选择模板（不能合成，但已生成的内容仍可被拉取）
        templateId: String(item.templateId || '').trim(),
        ruleAppendEnabled: !!item.ruleAppendEnabled,
        hostsAppendEnabled: !!item.hostsAppendEnabled,
        hasGenerated: !!item.hasGenerated,
        hostsRevision: Number(item.hostsRevision) || 0,
        hostsRebuildAttemptAtMs: Number(item.hostsRebuildAttemptAtMs) || 0,
        updatedAt: String(item.updatedAt || '')
    };
}

function normalizeOutputConfigList(list = []) {
    const usedIds = new Set();
    const usedTokens = new Set();
    const raw = Array.isArray(list) ? list.slice(0, MAX_OUTPUT_CONFIGS) : [];
    return raw.map((item, idx) => normalizeOutputConfig(item, idx, usedIds, usedTokens));
}

/**
 * 读取输出配置列表。
 * 旧数据使用 templateName（模板名）或 'template0'，这里迁移成模板 ID。
 */
async function readOutputConfigs(env) {
    const raw = await env.SUBPANEL_KV.get(KV_KEY_OUTPUT_CONFIGS);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            const normalized = normalizeOutputConfigList(parsed);
            if (normalized.length > 0) {
                return await migrateOutputConfigTemplateIds(env, normalized, parsed);
            }
        } catch (e) {
            // 落回下方的首次初始化
        }
    }

    // 首次初始化：从旧单配置结构迁移
    const legacyToken = (await env.SUBPANEL_KV.get(KV_KEY_CONFIG_TOKEN)) || generateRandomToken(16);
    const legacyConfig = await env.SUBPANEL_KV.get(KV_KEY_LEGACY_CONFIG);
    const ruleCfg = await readRuleAppendConfig(env);
    const templates = await readTemplates(env);
    const legacyTemplateId = resolveLegacyTemplateRef(LEGACY_DEFAULT_TEMPLATE_ID, templates);
    // 旧版 Hosts 配置有全局 enabled 开关，规范化后不再保留，这里直接读原始值
    let legacyHostsEnabled = false;
    try {
        legacyHostsEnabled = !!JSON.parse((await env.SUBPANEL_KV.get(KV_KEY_HOSTS_APPEND)) || '{}').enabled;
    } catch (e) {
        legacyHostsEnabled = false;
    }

    const initial = normalizeOutputConfig({
        id: 'cfg_1',
        name: '配置 1',
        token: legacyToken,
        templateId: templates.some(t => t.id === legacyTemplateId) ? legacyTemplateId : '',
        ruleAppendEnabled: !!ruleCfg.enabled,
        hostsAppendEnabled: legacyHostsEnabled,
        hasGenerated: !!legacyConfig,
        updatedAt: legacyConfig ? formatServerTime() : ''
    }, 0);

    if (legacyConfig) {
        const existing = await env.SUBPANEL_KV.get(`${OUTPUT_CONFIG_CONTENT_PREFIX}${initial.id}`);
        if (!existing) {
            await kvPut(env, `${OUTPUT_CONFIG_CONTENT_PREFIX}${initial.id}`, legacyConfig);
        }
    }

    const list = [initial];
    await kvPut(env, KV_KEY_OUTPUT_CONFIGS, JSON.stringify(list));
    return list;
}

/** 旧配置引用模板名或旧默认模板时，映射到模板 ID；映射不到则置空（未选择模板） */
async function migrateOutputConfigTemplateIds(env, configs, rawList) {
    const isLegacyRef = (item) => item && (
        (!item.templateId && item.templateName) ||
        item.templateId === LEGACY_DEFAULT_TEMPLATE_ID
    );
    if (!Array.isArray(rawList) || !rawList.some(isLegacyRef)) return configs;

    const templates = await readTemplates(env);
    configs.forEach((cfg, idx) => {
        const rawItem = rawList[idx];
        if (!isLegacyRef(rawItem)) return;
        const resolved = resolveLegacyTemplateRef(rawItem.templateId || rawItem.templateName, templates);
        cfg.templateId = templates.some(t => t.id === resolved) ? resolved : '';
    });

    await kvPut(env, KV_KEY_OUTPUT_CONFIGS, JSON.stringify(configs));
    return configs;
}

async function writeOutputConfigs(env, configs) {
    let normalized = normalizeOutputConfigList(configs);
    if (normalized.length === 0) {
        normalized = [normalizeOutputConfig({ id: 'cfg_1', name: '配置 1' }, 0)];
    }
    await kvPut(env, KV_KEY_OUTPUT_CONFIGS, JSON.stringify(normalized));
    // 兼容旧客户端：CONFIG_TOKEN 始终指向第一个配置
    await kvPut(env, KV_KEY_CONFIG_TOKEN, normalized[0].token);
    return normalized;
}

async function findOutputConfigByToken(env, token) {
    if (!token) return null;
    const configs = await readOutputConfigs(env);
    const matched = configs.find(cfg => timingSafeEqualString(cfg.token, token));
    if (matched) return matched;

    // 兼容旧链接：全局 CONFIG_TOKEN 指向第一个配置
    const legacyToken = await env.SUBPANEL_KV.get(KV_KEY_CONFIG_TOKEN);
    if (legacyToken && timingSafeEqualString(token, legacyToken)) {
        return configs[0] || null;
    }
    return null;
}

/** 遍历所有输出配置并批量更新引用（订阅改名、模板删除等场景） */
async function syncOutputConfigReferences(env, updater) {
    const raw = await env.SUBPANEL_KV.get(KV_KEY_OUTPUT_CONFIGS);
    if (!raw) return null;
    let configs;
    try {
        configs = normalizeOutputConfigList(JSON.parse(raw));
    } catch (e) {
        return null;
    }
    if (!configs.length) return null;

    let changed = false;
    for (const cfg of configs) {
        if (updater(cfg)) changed = true;
    }
    if (changed) {
        await kvPut(env, KV_KEY_OUTPUT_CONFIGS, JSON.stringify(configs));
    }
    return configs;
}

// ====== [MODULE: 08_services.js] ======
// ============================================================================
// 外部资源服务：订阅抓取与解析、Hosts 订阅抓取、模板抓取与校验
// ============================================================================

const FETCH_TIMEOUT_MS = 15000;
const PROBE_TIMEOUT_MS = 8000;

/** 抓取订阅正文，带超时与体积限制 */
async function fetchSubscriptionContent(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'User-Agent': 'mihomo/1.19.16 ClashMeta' },
            signal: controller.signal
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const declaredSize = Number(response.headers.get('Content-Length'));
        if (Number.isFinite(declaredSize) && declaredSize > MAX_SUBSCRIPTION_INPUT_BYTES) {
            throw new Error('订阅内容超过 2 MiB 限制');
        }
        const content = await response.text();
        if (utf8ByteLength(content) > MAX_SUBSCRIPTION_INPUT_BYTES) {
            throw new Error('订阅内容超过 2 MiB 限制');
        }
        return content;
    } catch (err) {
        if (err && err.name === 'AbortError') {
            throw new Error('获取订阅内容超时');
        }
        throw new Error(`获取订阅失败: ${err.message || err}`);
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * 探测订阅可连通性。
 * 统一使用 GET + Range，只读取响应头即中止正文下载：
 * 部分机场对 HEAD 返回 405/403，之前先 HEAD 再回退会白等一轮超时。
 */
async function probeSubscriptionConnectivity(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'mihomo/1.19.16 ClashMeta',
                Range: 'bytes=0-0'
            },
            signal: controller.signal
        });
        if (res.body && typeof res.body.cancel === 'function') {
            try {
                await res.body.cancel();
            } catch (e) {
                // 忽略中止正文失败的异常
            }
        }
        if (!res.ok && res.status !== 206) {
            return { ok: false, error: `Status ${res.status}` };
        }
        return { ok: true };
    } catch (e) {
        if (e && e.name === 'AbortError') {
            return { ok: false, error: '连接超时' };
        }
        return { ok: false, error: e.message || '连接失败' };
    } finally {
        clearTimeout(timeoutId);
    }
}

/** 把订阅原始文本解析为规范节点列表（复用内嵌解析器） */
function processSubscriptionContent(content, subName) {
    if (!content || !content.trim()) {
        throw new Error('订阅内容为空');
    }
    if (utf8ByteLength(content) > MAX_SUBSCRIPTION_INPUT_BYTES) {
        throw new Error('订阅内容超过 2 MiB 限制');
    }

    const filtered = filterNodes(detectAndParse(content, 0));
    if (filtered.length === 0) {
        throw new Error('未解析到有效节点');
    }

    if (subName) {
        for (const node of filtered) {
            if (node.name) node.name = `${subName} ${node.name}`;
        }
    }

    const lines = filtered.map(node => JSON.stringify(node));
    const output = lines.join('\n');
    if (utf8ByteLength(output) > MAX_SUBSCRIPTION_OUTPUT_BYTES) {
        throw new Error('解析后的节点内容超过 4 MiB 限制');
    }

    return { nodeCount: lines.length, content: output };
}

async function processSubscriptionFromUrl(url, subName) {
    const content = await fetchSubscriptionContent(url);
    return processSubscriptionContent(content, subName);
}

/** 抓取并解析 Hosts 订阅 */
async function fetchHostsSubscription(url) {
    const raw = await fetchSubscriptionContent(url);
    const parsed = parseHostsSubscription(raw);
    if (!parsed.ok) {
        throw new Error(parsed.error || '未解析到有效的 Hosts 记录');
    }
    return parsed.entries;
}

const TEMPLATE_FETCH_TIMEOUT_MS = 15000;

/** 抓取模板并校验结构（必须含 proxy-groups 与 rules） */
async function fetchAndValidateTemplate(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TEMPLATE_FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'ClashMeta' },
            signal: controller.signal
        });
        if (!res.ok) return { error: `HTTP ${res.status}` };
        const text = await res.text();
        if (utf8ByteLength(text) > MAX_SUBSCRIPTION_INPUT_BYTES) {
            return { error: '模板内容超过 2 MiB 限制' };
        }
        const parsed = parseTemplateYaml(text);
        if (!parsed.ok) return { error: parsed.error };
        return { content: text };
    } catch (e) {
        if (e && e.name === 'AbortError') return { error: '模板下载超时' };
        return { error: e.message || '模板下载失败' };
    } finally {
        clearTimeout(timeoutId);
    }
}

// ====== [MODULE: 09_composer.js] ======
// ============================================================================
// 配置合成器：模板 + 附加规则 + Hosts + 节点/Provider -> 完整 YAML
// 设计要点：
//   1. 统一走"完整重新生成"，不再对已有 YAML 打局部补丁，避免上游删除的条目残留。
//   2. 节点同名自动追加序号，避免 Mihomo 因重名拒绝启动。
//   3. Provider 与 hosts 值统一 YAML 安全序列化。
// ============================================================================

/** 生成 proxy-providers 条目（名称/URL/path/prefix 全部安全转义，以两空格为基准缩进） */
function buildProviderYaml(sub) {
    const name = String(sub.name || '').trim();
    const interval = sub.autoUpdate ? 3600 : 0;
    return [
        `  ${yamlQuoteScalar(name)}:`,
        `    type: http`,
        `    url: ${yamlQuoteScalar(sub.url)}`,
        `    path: ${yamlQuoteScalar(`./providers/${name}.yaml`)}`,
        `    interval: ${interval}`,
        `    override:`,
        `      additional-prefix: ${yamlQuoteScalar(`${name} `)}`
    ].join('\n');
}

/**
 * 单行节点 JSON 去重：同名节点追加 " #2"、" #3" 序号。
 * 同时负责剔除非法行，避免污染 proxies 块。
 */
function deduplicateProxyLine(rawLine, usedNames) {
    const trimmed = String(rawLine || '').trim();
    if (!trimmed) return null;

    let parsed;
    try {
        parsed = JSON.parse(trimmed);
    } catch (e) {
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (typeof parsed.name !== 'string' || !parsed.name.trim()) return null;

    const baseName = parsed.name.trim();
    let finalName = baseName;
    let suffix = 2;
    while (usedNames.has(finalName)) {
        finalName = `${baseName} #${suffix}`;
        suffix++;
    }
    usedNames.add(finalName);

    if (finalName !== parsed.name) {
        parsed.name = finalName;
    }
    return JSON.stringify(parsed);
}

/**
 * 核心合成函数。
 * options:
 *   subNames, nodeNames, templateId, useRuleAppend, useHostsAppend
 *   prefetched: { subs, nodes, catalog, ruleConfig, hostsConfig } 用于减少重复 KV 读取
 * 返回 { ok, content, skippedRules } 或 { error }
 */
async function buildConfigYaml(env, options = {}) {
    const prefetched = options.prefetched || {};

    const subs = prefetched.subs || await readSubs(env);
    const nodes = prefetched.nodes || await readNodes(env);
    // 合成只需要选中模板，不为生成一份配置解析其余全部模板。
    const catalog = prefetched.catalog || { templates: await readTemplates(env) };
    const ruleConfig = options.useRuleAppend ? (prefetched.ruleConfig || await readRuleAppendConfig(env)) : null;
    const hostsConfig = options.useHostsAppend ? (prefetched.hostsConfig || await readHostsAppendConfig(env)) : null;

    const templateId = String(options.templateId || '').trim();
    const subNames = Array.isArray(options.subNames) ? options.subNames : [];
    const nodeNames = Array.isArray(options.nodeNames) ? options.nodeNames : [];
    if (subNames.some(name => !subs.some(sub => sub.name === name))
        || nodeNames.some(name => !nodes.some(node => node.name === name))) {
        return { error: '所选订阅或节点已不存在，请刷新页面后重新选择' };
    }

    // 1. 取模板正文
    const templateResult = await getTemplateContentById(env, templateId, catalog);
    if (templateResult.error) {
        return { error: templateResult.error };
    }
    const baseCheck = (catalog.parsedByTemplate || {})[templateId] || parseTemplateYaml(templateResult.content);
    if (!baseCheck.ok) {
        return { error: baseCheck.error };
    }
    if (catalog.parsedByTemplate) catalog.parsedByTemplate[templateId] = baseCheck;
    let workingTemplate = templateResult.content;

    // 2. 附加规则（插到 rules 顶部，优先匹配）
    let skippedRules = [];
    if (options.useRuleAppend) {
        const resolved = resolveRulesForTemplate(ruleConfig, templateId, workingTemplate, baseCheck);
        skippedRules = resolved.skipped;
        if (resolved.activeLines.length > 0) {
            const inserted = insertRulesIntoBlock(workingTemplate, resolved.activeLines);
            if (inserted.error) return { error: inserted.error };
            workingTemplate = inserted.content;
        }
    }

    // 3. Hosts 合并
    if (options.useHostsAppend) {
        const staticValidation = validateStaticHostsContent(hostsConfig.staticContent);
        if (!staticValidation.ok) {
            return { error: `Hosts 静态内容校验失败: ${staticValidation.errors[0]}`, validation: staticValidation };
        }
        const mergedEntries = buildMergedHostsEntries(hostsConfig);
        if (mergedEntries.length > 0) {
            workingTemplate = mergeHostsIntoTemplate(workingTemplate, mergedEntries).content;
        }
    }

    // 自检：规则/Hosts 插入后模板仍须是合法 YAML，避免把坏配置下发给客户端。
    // 只解析模板部分（体积小），不解析含上千节点的最终文本，控制 CPU 耗时。
    if (workingTemplate !== templateResult.content) {
        const recheck = parseTemplateYaml(workingTemplate);
        if (!recheck.ok) {
            return { error: `插入附加内容后模板无法解析，已保留旧配置: ${recheck.error}` };
        }
    }

    // 4. 订阅节点 / Provider
    const providerEntries = [];
    const proxyLines = [];
    const usedNames = new Set((Array.isArray(baseCheck.doc.proxies) ? baseCheck.doc.proxies : [])
        .map(node => node && node.name).filter(name => typeof name === 'string'));
    const existingProviders = new Set(Object.keys(baseCheck.doc['proxy-providers'] || {}));

    if (subNames.length > 0) {
        const selectedSubs = subs.filter(sub => subNames.includes(sub.name));
        for (const sub of selectedSubs) {
            if (sub.useProvider) {
                if (existingProviders.has(sub.name)) {
                    return { error: `订阅「${sub.name}」与模板已有的 proxy-provider 同名，请修改订阅名称或模板` };
                }
                existingProviders.add(sub.name);
                providerEntries.push(buildProviderYaml(sub));
                continue;
            }
            const cached = await env.SUBPANEL_KV.get(`${SUBSCRIPTION_CACHE_PREFIX}${sub.name}`);
            if (!cached) return { error: `订阅「${sub.name}」缺少节点缓存，请先刷新、上传或粘贴节点内容` };
            const beforeCount = proxyLines.length;
            for (const line of cached.split('\n')) {
                const deduped = deduplicateProxyLine(line, usedNames);
                if (deduped) proxyLines.push(`  - ${deduped}`);
            }
            if (proxyLines.length === beforeCount) {
                return { error: `订阅「${sub.name}」的缓存中没有有效节点，请重新解析` };
            }
        }
    }

    // 5. 手动单节点
    if (nodeNames.length > 0) {
        for (const node of nodes.filter(n => nodeNames.includes(n.name))) {
            const deduped = deduplicateProxyLine(node.content, usedNames);
            if (deduped) proxyLines.push(`  - ${deduped}`);
        }
    }

    // 6. 合并 proxies / proxy-providers（模板已有同名顶层键时并入，避免重复键）
    let output = workingTemplate;
    const providerLines = providerEntries.length > 0 ? providerEntries.join('\n').split('\n') : [];
    const blocks = [
        { key: 'proxies', lines: proxyLines },
        { key: 'proxy-providers', lines: providerLines }
    ];
    for (const block of blocks) {
        if (block.lines.length === 0) continue;
        const merged = mergeTopLevelBlock(output, block.key, block.lines);
        if (merged.error) return { error: merged.error };
        output = merged.content;
    }

    return {
        ok: true,
        content: `${output.replace(/\s+$/, '')}\n`,
        skippedRules,
        hostsRevision: hostsConfig ? hostsConfig.revision : 0
    };
}

/** 生成并写回某个输出配置的 YAML 缓存（统一重新生成入口） */
async function rebuildOutputConfig(env, config, prefetched = null) {
    if (!config) return { error: '配置不存在' };
    const built = await buildConfigYaml(env, {
        subNames: config.subNames,
        nodeNames: config.nodeNames,
        templateId: config.templateId,
        useRuleAppend: config.ruleAppendEnabled,
        useHostsAppend: config.hostsAppendEnabled,
        prefetched: prefetched || undefined
    });
    if (built.error) return built;

    await kvPut(env, `${OUTPUT_CONFIG_CONTENT_PREFIX}${config.id}`, built.content);
    config.hostsRevision = built.hostsRevision;
    return built;
}

/** 读取已生成的配置内容（带旧键回退） */
async function readGeneratedConfig(env, config) {
    if (!config) return '';
    const content = await env.SUBPANEL_KV.get(`${OUTPUT_CONFIG_CONTENT_PREFIX}${config.id}`);
    if (content) return content;
    if (config.id === 'cfg_1') {
        return (await env.SUBPANEL_KV.get(KV_KEY_LEGACY_CONFIG)) || '';
    }
    return '';
}

// ====== [MODULE: 10_hosts_autoupdate.js] ======
// ============================================================================
// Hosts 自动更新：Cron 触发 + /config 请求 waitUntil 兜底
// 同一 isolate 内避免重复更新；KV 不是分布式锁，跨区域仍可能重复抓取。
// 用 Hosts revision / 输出配置 hostsRevision 持久化待重建状态，分批完成所有配置。
// ============================================================================

const hostsUpdatesInFlight = new WeakSet();

/** 抓取与保存分离，只写一次 Hosts 配置；无到期订阅时仍继续处理待重建配置。 */
async function autoUpdateHosts(env, options = {}) {
    let config = await readHostsAppendConfig(env);
    if (hostsUpdatesInFlight.has(env.SUBPANEL_KV)) {
        return { config, updated: false, entriesChanged: false, rebuiltIds: [] };
    }
    hostsUpdatesInFlight.add(env.SUBPANEL_KV);
    try {
        const nowMs = Date.now();
        const due = config.subs.filter(sub => {
            if (!sub.autoUpdate) return false;
            const lastSuccess = sub.updatedAtMs || (sub.updatedAt ? Date.parse(sub.updatedAt) || 0 : 0);
            if (lastSuccess > 0 && nowMs - lastSuccess < HOSTS_AUTO_UPDATE_INTERVAL_MS) return false;
            return !(sub.lastAttemptAtMs > 0 && nowMs - sub.lastAttemptAtMs < HOSTS_AUTO_UPDATE_RETRY_COOLDOWN_MS);
        });

        let entriesChanged = false;
        if (due.length > 0) {
            // 最多 5 个源并行抓取，15 秒总超时，避免串行请求超出 waitUntil 的 30 秒期限。
            const results = await Promise.all(due.map(async sub => {
                try {
                    return { sub, entries: await fetchHostsSubscription(sub.url) };
                } catch (e) {
                    reportBackgroundError('Hosts 订阅更新', e);
                    return { sub, error: e.message || '自动更新失败' };
                }
            }));

            // 抓取期间用户可能编辑/删除订阅或静态 Hosts，基于最新数据合并，不整份覆盖旧快照。
            config = await writeHostsAppendConfig(env, latest => {
                entriesChanged = false;
                let refreshed = false;
                const subs = latest.subs.map(sub => {
                    const result = results.find(item => item.sub.name === sub.name && item.sub.url === sub.url);
                    if (!result || !sub.autoUpdate || sub.lastAttemptAtMs > nowMs) return sub;
                    if (result.error) return { ...sub, lastAttemptAtMs: nowMs, lastError: result.error };
                    refreshed = true;
                    if (JSON.stringify(sub.entries) !== JSON.stringify(result.entries)) entriesChanged = true;
                    return {
                        ...sub,
                        entries: result.entries,
                        updatedAt: formatServerTime(nowMs),
                        updatedAtMs: nowMs,
                        lastAttemptAtMs: nowMs,
                        lastError: ''
                    };
                });
                // 首次成功刷新建立基线，让升级前可能遗漏的输出也能追平一次。
                const advanceRevision = entriesChanged || (refreshed && latest.revision === 0);
                return { ...latest, revision: latest.revision + (advanceRevision ? 1 : 0), subs };
            });
        }

        let rebuiltIds = [];
        if (options.updateConfigs && config.revision > 0) {
            rebuiltIds = await rebuildHostsDependentConfigs(env, config, options.maxRebuild);
        }
        return { config, updated: due.length > 0, entriesChanged, rebuiltIds };
    } finally {
        hostsUpdatesInFlight.delete(env.SUBPANEL_KV);
    }
}

/** 分批重建版本落后的输出配置；失败保留待重建状态，并轮转，避免阻塞后续配置。 */
async function rebuildHostsDependentConfigs(env, hostsConfig, maxRebuild = 0) {
    const raw = await env.SUBPANEL_KV.get(KV_KEY_OUTPUT_CONFIGS);
    if (!raw) return [];
    let configs;
    try {
        configs = normalizeOutputConfigList(JSON.parse(raw));
    } catch (e) {
        return [];
    }
    const targets = configs.filter(cfg => cfg.hostsAppendEnabled && cfg.hasGenerated
        && cfg.hostsRevision < hostsConfig.revision)
        .sort((a, b) => a.hostsRebuildAttemptAtMs - b.hostsRebuildAttemptAtMs);
    if (!targets.length) return [];
    const limit = maxRebuild > 0 ? Math.min(maxRebuild, targets.length) : targets.length;
    const [subs, nodes, templates, ruleConfig] = await Promise.all([
        readSubs(env), readNodes(env), readTemplates(env), readRuleAppendConfig(env)
    ]);
    const prefetched = { hostsConfig, subs, nodes, catalog: { templates, parsedByTemplate: {} }, ruleConfig };
    const attempts = [];
    const rebuilt = [];
    for (const cfg of targets.slice(0, limit)) {
        cfg.hostsRebuildAttemptAtMs = Date.now();
        try {
            const result = await rebuildOutputConfig(env, cfg, prefetched);
            if (result.ok) {
                cfg.updatedAt = formatServerTime();
                rebuilt.push(cfg.id);
            } else {
                reportBackgroundError('Hosts 配置重建', new Error(`${cfg.id}: ${result.error}`));
            }
        } catch (e) {
            reportBackgroundError('Hosts 配置重建', e);
        }
        attempts.push(cfg);
    }

    // 仅合并重建元数据，不拿开始时的旧列表覆盖用户在此期间保存的选择、名称或 Token。
    await kvPut(env, KV_KEY_OUTPUT_CONFIGS, async () => {
        const latestRaw = await env.SUBPANEL_KV.get(KV_KEY_OUTPUT_CONFIGS);
        if (!latestRaw) return undefined;
        const latest = normalizeOutputConfigList(JSON.parse(latestRaw));
        for (const cfg of latest) {
            const attempt = attempts.find(item => item.id === cfg.id);
            if (!attempt) continue;
            const sameSelection = cfg.templateId === attempt.templateId
                && cfg.hostsAppendEnabled === attempt.hostsAppendEnabled
                && cfg.ruleAppendEnabled === attempt.ruleAppendEnabled
                && JSON.stringify(cfg.subNames) === JSON.stringify(attempt.subNames)
                && JSON.stringify(cfg.nodeNames) === JSON.stringify(attempt.nodeNames);
            if (!sameSelection) continue;
            cfg.hostsRebuildAttemptAtMs = attempt.hostsRebuildAttemptAtMs;
            if (rebuilt.includes(cfg.id)) {
                cfg.hostsRevision = attempt.hostsRevision;
                cfg.updatedAt = attempt.updatedAt;
            }
        }
        return JSON.stringify(latest);
    });
    return rebuilt;
}

// ====== [MODULE: 11_api_core.js] ======
// ============================================================================
// API 路由与 Worker 入口
// ============================================================================

/** 读取或初始化管理员密码 */
async function ensureAdminPassword(env) {
    let pass = await env.SUBPANEL_KV.get(KV_KEY_ADMIN_PASSWORD);
    if (!pass) {
        pass = 'admin';
        await kvPut(env, KV_KEY_ADMIN_PASSWORD, pass);
    }
    return pass;
}

async function isAuthorized(request, adminPass) {
    const headerPass = request.headers.get('x-admin-password');
    if (headerPass && timingSafeEqualString(headerPass, adminPass)) {
        return { ok: true, viaHeader: true };
    }
    const cookies = parseCookies(request.headers.get('Cookie') || '');
    const token = cookies[SESSION_COOKIE_NAME];
    if (token && await verifySessionToken(token, adminPass)) {
        return { ok: true, viaHeader: false };
    }
    return { ok: false };
}

/** 登录失败计数，简单节流防止暴力尝试 */
async function readLoginGuard(env) {
    const raw = await env.SUBPANEL_KV.get(KV_KEY_LOGIN_GUARD);
    if (!raw) return { fails: 0, firstAt: 0 };
    try {
        const parsed = JSON.parse(raw);
        return {
            fails: Number(parsed.fails) || 0,
            firstAt: Number(parsed.firstAt) || 0
        };
    } catch (e) {
        return { fails: 0, firstAt: 0 };
    }
}

async function recordLoginFailure(env) {
    const now = Date.now();
    const guard = await readLoginGuard(env);
    const withinWindow = guard.firstAt > 0 && now - guard.firstAt < LOGIN_FAIL_WINDOW_MS;
    const next = withinWindow
        ? { fails: guard.fails + 1, firstAt: guard.firstAt }
        : { fails: 1, firstAt: now };
    await kvPut(env, KV_KEY_LOGIN_GUARD, JSON.stringify(next));
    return next;
}

async function clearLoginFailures(env) {
    await kvPut(env, KV_KEY_LOGIN_GUARD, JSON.stringify({ fails: 0, firstAt: 0 }));
}

/** 统一鉴权后的 API 处理 */
async function handleApi(request, env, ctx, url) {
    const path = url.pathname;
    const method = request.method;
    const adminPass = await ensureAdminPassword(env);
    const useSecureCookie = url.protocol === 'https:';

    const err = (msg, status = 400, extra = {}) => jsonResponse({ error: msg, ...extra }, status);
    const ok = (data, extraHeaders = {}) => jsonResponse(data, 200, extraHeaders);

    // ---------- 认证（无需鉴权） ----------
    if (path === '/api/auth/verify' && method === 'POST') {
        let body = {};
        try {
            body = await request.json();
        } catch (e) {
            body = {};
        }
        const guard = await readLoginGuard(env);
        if (guard.fails >= LOGIN_FAIL_LIMIT && Date.now() - guard.firstAt < LOGIN_FAIL_WINDOW_MS) {
            const waitMin = Math.ceil((LOGIN_FAIL_WINDOW_MS - (Date.now() - guard.firstAt)) / 60000);
            return err(`登录失败次数过多，请 ${waitMin} 分钟后再试`, 429);
        }

        const password = String(body.password || '');
        if (!password || !timingSafeEqualString(password, adminPass)) {
            await recordLoginFailure(env);
            return err('密码错误', 401);
        }

        await clearLoginFailures(env);
        const token = await createSessionToken(adminPass);
        return ok(
            { success: true, mustChangePassword: adminPass === 'admin' },
            { 'Set-Cookie': buildSessionCookie(token, useSecureCookie) }
        );
    }

    if (path === '/api/auth/session' && method === 'GET') {
        const auth = await isAuthorized(request, adminPass);
        return ok({
            authenticated: auth.ok,
            mustChangePassword: auth.ok && adminPass === 'admin'
        });
    }

    if (path === '/api/auth/logout' && method === 'POST') {
        return ok({ success: true }, { 'Set-Cookie': buildClearedSessionCookie(useSecureCookie) });
    }

    // ---------- 其余 API 需要鉴权 ----------
    if (!path.startsWith('/api/')) {
        return new Response('Not Found', { status: 404 });
    }
    const auth = await isAuthorized(request, adminPass);
    if (!auth.ok) {
        return err('未授权：请先登录', 401);
    }

    // ---------- 密码管理 ----------
    if (path === '/api/auth/password' && method === 'POST') {
        let body = {};
        try {
            body = await request.json();
        } catch (e) {
            return err('请求体不是有效 JSON');
        }
        const newPass = String(body.newPassword || '').trim();
        if (newPass.length < MIN_ADMIN_PASSWORD_LENGTH) {
            return err(`新密码长度不能少于 ${MIN_ADMIN_PASSWORD_LENGTH} 位`);
        }
        if (timingSafeEqualString(newPass, adminPass)) {
            return err('新密码不能与当前密码相同');
        }
        await kvPut(env, KV_KEY_ADMIN_PASSWORD, newPass);
        await clearLoginFailures(env);
        // 密码变更后旧会话全部失效，这里签发新会话
        const token = await createSessionToken(newPass);
        return ok({ success: true }, { 'Set-Cookie': buildSessionCookie(token, useSecureCookie) });
    }

    // ---------- 聚合状态 ----------
    if (path === '/api/state' && method === 'GET') {
        scheduleHostsAutoUpdate(env, ctx);
        return await handleStateGet(env, ok, adminPass);
    }

    // ---------- 备份 ----------
    if (path === '/api/backup/export' && method === 'GET') {
        return await handleBackupExport(env, ok);
    }
    if (path === '/api/backup/import' && method === 'POST') {
        return await handleBackupImport(request, env, ok, err);
    }

    // ---------- 输出配置 ----------
    if (path.startsWith('/api/output/')) {
        return await handleOutputRoutes(request, env, path, method, ok, err);
    }

    // ---------- 规则附加 ----------
    if (path.startsWith('/api/rule-append/')) {
        return await handleRuleAppendRoutes(request, env, path, method, ok, err);
    }

    // ---------- Hosts 附加 ----------
    if (path.startsWith('/api/hosts-append/')) {
        return await handleHostsAppendRoutes(request, env, path, method, ok, err);
    }

    // ---------- 手动触发 Hosts 到期检查（同步等待结果） ----------
    if (path === '/api/hosts-check' && method === 'POST') {
        const result = await autoUpdateHosts(env, { updateConfigs: true });
        return ok({ updated: result.updated, rebuiltIds: result.rebuiltIds, config: presentHostsConfig(result.config) });
    }

    // ---------- 订阅 ----------
    if (path.startsWith('/api/sub/')) {
        return await handleSubRoutes(request, env, path, method, ok, err);
    }

    // ---------- 单节点 ----------
    if (path.startsWith('/api/node/')) {
        return await handleNodeRoutes(request, env, path, method, ok, err);
    }

    // ---------- 模板 ----------
    if (path.startsWith('/api/template/')) {
        return await handleTemplateRoutes(request, env, path, method, ok, err);
    }

    // ---------- 历史兼容：/api/merge ----------
    if (path === '/api/merge' && method === 'POST') {
        return await handleMerge(request, env, ok, err);
    }

    // ---------- 旧 token 接口（兼容） ----------
    if (path.startsWith('/api/token/')) {
        const configs = await readOutputConfigs(env);
        if (path === '/api/token/get') return ok({ token: configs[0].token });
        if (path === '/api/token/reset' && method === 'POST') {
            return err('请使用 /api/output/reset-token', 410);
        }
    }

    return err('未知接口', 404);
}

/** 后台触发 Hosts 到期检查，不阻塞当前响应；无 ctx（测试环境）时忽略 */
function scheduleHostsAutoUpdate(env, ctx) {
    if (!ctx || typeof ctx.waitUntil !== 'function') return;
    ctx.waitUntil(autoUpdateHosts(env, { updateConfigs: true, maxRebuild: 1 })
        .catch(e => reportBackgroundError('Hosts 后台更新', e)));
}

/** 模板摘要（不含正文） */
function summarizeTemplate(tpl, knownGroups = null) {
    const groups = Array.isArray(knownGroups) ? knownGroups : extractProxyGroupNames(tpl.content);
    return {
        id: tpl.id,
        name: tpl.name,
        type: tpl.type,
        url: tpl.url,
        updatedAt: tpl.updatedAt,
        groupCount: groups.length,
        groups
    };
}

// ====== 状态聚合 ======
async function handleStateGet(env, ok, adminPass) {
    const [subs, nodes, catalog, ruleConfig, hostsConfig, outputConfigs] = await Promise.all([
        readSubs(env),
        readNodes(env),
        readTemplateCatalog(env),
        readRuleAppendConfig(env),
        readHostsAppendConfig(env),
        readOutputConfigs(env)
    ]);

    return ok({
        mustChangePassword: adminPass === 'admin',
        maxTemplates: MAX_TEMPLATES,
        subs,
        nodes,
        templates: catalog.templates.map(tpl => summarizeTemplate(tpl, catalog.groupsByTemplate[tpl.id])),
        ruleAppend: {
            config: ruleConfig,
            allGroups: catalog.allGroups,
            groupsByTemplate: catalog.groupsByTemplate
        },
        hostsAppend: presentHostsConfig(hostsConfig),
        outputConfigs
    });
}

// ====== 备份导出/导入 ======
async function handleBackupExport(env, ok) {
    const [subs, nodes, templates, ruleConfig, hostsConfig, outputConfigs] = await Promise.all([
        readSubs(env),
        readNodes(env),
        readTemplates(env),
        readRuleAppendConfig(env),
        readHostsAppendConfig(env),
        readOutputConfigs(env)
    ]);

    const cachedSubs = await Promise.all(subs.map(async sub => [
        sub.name, await env.SUBPANEL_KV.get(`${SUBSCRIPTION_CACHE_PREFIX}${sub.name}`)
    ]));
    return ok({
        version: 5,
        exportedAt: formatServerTime(),
        notice: '该备份包含订阅链接、节点缓存与全部配置 Token，请妥善保管；不包含管理员密码及已生成的 YAML，恢复后请合成更新。',
        data: {
            SUBS: subs,
            NODES: nodes,
            TEMPLATES: templates,
            RULE_APPEND_CONFIG: ruleConfig,
            HOSTS_APPEND_CONFIG: hostsConfig,
            OUTPUT_CONFIGS: outputConfigs,
            SUBSCRIPTION_CACHES: Object.fromEntries(cachedSubs.filter(([, content]) => content))
        }
    });
}

/**
 * 导入备份。兼容旧版备份：
 * - 旧备份里的 template0（内置默认模板）按同样的迁移规则转为普通模板
 * - 导入数据在内存中迁移后写入，避免先写旧结构、再回读迁移。
 * - 恢复节点列表缓存；旧备份缺缓存时清空节点统计，生成时要求重新解析。
 * - 不恢复已生成 YAML；清理旧正文并重置生成状态，避免把旧缓存当成导入结果。
 */
async function handleBackupImport(request, env, ok, err) {
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return err('备份文件不是有效 JSON');
    }
    const data = body && body.data ? body.data : body;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return err('备份文件结构无效');
    }

    const hasKnownKey = ['SUBS', 'NODES', 'TEMPLATES', 'RULE_APPEND_CONFIG', 'HOSTS_APPEND_CONFIG', 'OUTPUT_CONFIGS', 'template0']
        .some(key => key in data);
    if (!hasKnownKey) {
        return err('备份文件缺少可识别的数据字段');
    }
    if (typeof data.template0 === 'string' && data.template0.trim()) {
        const parsed = parseTemplateYaml(data.template0);
        if (!parsed.ok) return err(`旧默认模板无效: ${parsed.error}`);
    }

    // 所有缓存先校验，再开始写入，避免坏缓存造成半导入。
    const importedSubs = Array.isArray(data.SUBS)
        ? data.SUBS.slice(0, MAX_SUBS).map(normalizeSub).filter(sub => sub.name && sub.url) : null;
    const caches = data.SUBSCRIPTION_CACHES || {};
    const validatedCaches = new Map();
    for (const sub of importedSubs || []) {
        if (!Object.prototype.hasOwnProperty.call(caches, sub.name)) continue;
        const content = caches[sub.name];
        if (typeof content !== 'string' || utf8ByteLength(content) > MAX_SUBSCRIPTION_OUTPUT_BYTES) {
            return err(`订阅「${sub.name}」的备份缓存无效或超过 4 MiB`);
        }
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length > MAX_SUBSCRIPTION_NODES) return err(`订阅「${sub.name}」的备份缓存节点过多`);
        try {
            for (const line of lines) {
                const node = JSON.parse(line);
                if (!node || typeof node !== 'object' || Array.isArray(node)
                    || typeof node.name !== 'string' || !node.name.trim() || !node.type || !node.server) {
                    throw new Error('invalid node');
                }
            }
        } catch (e) {
            return err(`订阅「${sub.name}」的备份缓存不是有效节点列表`);
        }
        if (lines.length) validatedCaches.set(sub.name, { content: lines.join('\n'), count: lines.length });
    }

    if (importedSubs) {
        for (const sub of importedSubs) {
            const cache = validatedCaches.get(sub.name);
            if (cache) {
                await kvPut(env, `${SUBSCRIPTION_CACHE_PREFIX}${sub.name}`, cache.content);
                sub.nodeCount = cache.count;
            } else {
                await kvDelete(env, `${SUBSCRIPTION_CACHE_PREFIX}${sub.name}`);
                sub.nodeCount = 0;
                sub.lastUpdate = null;
                sub.lastSource = '';
            }
        }
        await writeSubs(env, importedSubs);
    }
    if (Array.isArray(data.NODES)) await writeNodes(env, data.NODES.slice(0, MAX_NODES));
    let templates = Array.isArray(data.TEMPLATES)
        ? normalizeTemplates(data.TEMPLATES.slice(0, MAX_TEMPLATES)).templates : await readTemplates(env);
    const hasLegacyTemplate = typeof data.template0 === 'string' && data.template0.trim();
    if (hasLegacyTemplate && !templates.some(tpl => tpl.id === MIGRATED_DEFAULT_TEMPLATE_ID)) {
        const usedNames = new Set(templates.map(tpl => tpl.name));
        let name = MIGRATED_DEFAULT_TEMPLATE_NAME;
        let suffix = 2;
        while (usedNames.has(name)) name = `${MIGRATED_DEFAULT_TEMPLATE_NAME} ${suffix++}`;
        templates.unshift({
            id: MIGRATED_DEFAULT_TEMPLATE_ID, name, type: 'txt', url: '',
            content: data.template0, updatedAt: formatServerTime()
        });
    }
    if (Array.isArray(data.TEMPLATES) || hasLegacyTemplate) {
        templates = await writeTemplates(env, templates);
        await kvDelete(env, KV_KEY_LEGACY_DEFAULT_TEMPLATE);
        await kvDelete(env, KV_KEY_LEGACY_DEFAULT_TEMPLATE_META);
    }

    if (data.RULE_APPEND_CONFIG && typeof data.RULE_APPEND_CONFIG === 'object' && !Array.isArray(data.RULE_APPEND_CONFIG)) {
        const current = await readRuleAppendConfig(env);
        const source = { ...data.RULE_APPEND_CONFIG, revision: current.revision };
        source.templateId = resolveLegacyTemplateRef(source.templateId || source.templateName, templates);
        if (Array.isArray(source.rules)) {
            source.rules = source.rules.map(rule => ({
                ...rule,
                target: resolveLegacyTemplateRef(rule && rule.target || RULE_TARGET_GLOBAL, templates)
            }));
        }
        await writeRuleAppendConfig(env, source);
    }
    if (data.HOSTS_APPEND_CONFIG && typeof data.HOSTS_APPEND_CONFIG === 'object') {
        await writeHostsAppendConfig(env, data.HOSTS_APPEND_CONFIG);
    }
    if (Array.isArray(data.OUTPUT_CONFIGS) && data.OUTPUT_CONFIGS.length > 0) {
        const imported = normalizeOutputConfigList(data.OUTPUT_CONFIGS);
        imported.forEach((cfg, index) => {
            const raw = data.OUTPUT_CONFIGS[index];
            const ref = raw.templateId || raw.templateName;
            const resolved = ref ? resolveLegacyTemplateRef(ref, templates) : '';
            cfg.templateId = templates.some(tpl => tpl.id === resolved) ? resolved : '';
            cfg.hasGenerated = false;
            cfg.updatedAt = '';
            cfg.hostsRevision = 0;
            cfg.hostsRebuildAttemptAtMs = 0;
        });
        const previous = await readJsonArray(env, KV_KEY_OUTPUT_CONFIGS);
        for (const id of new Set([...previous, ...imported].map(cfg => cfg.id).filter(Boolean))) {
            await kvDelete(env, `${OUTPUT_CONFIG_CONTENT_PREFIX}${id}`);
        }
        await kvDelete(env, KV_KEY_LEGACY_CONFIG);
        await writeOutputConfigs(env, imported);
    }

    return ok({ success: true });
}

// ====== 输出配置路由 ======
async function handleOutputRoutes(request, env, path, method, ok, err) {
    const configs = await readOutputConfigs(env);

    if (path === '/api/output/list' && method === 'GET') {
        return ok({ configs });
    }

    let body = {};
    if (method === 'POST') {
        try {
            body = await request.json();
        } catch (e) {
            return err('请求体不是有效 JSON');
        }
    }

    if (path === '/api/output/preview' && method === 'POST') {
        const target = configs.find(cfg => cfg.id === body.id) || configs[0];
        if (!target) return err('配置不存在');
        const content = await readGeneratedConfig(env, target);
        return ok({
            content: content || '# 尚未生成配置内容，请先点击「合成更新」。',
            config: target
        });
    }

    if (path === '/api/output/add' && method === 'POST') {
        if (configs.length >= MAX_OUTPUT_CONFIGS) {
            return err(`最多同时保存 ${MAX_OUTPUT_CONFIGS} 个配置`);
        }
        const usedIds = new Set(configs.map(cfg => cfg.id));
        let seq = 1;
        while (usedIds.has(`cfg_${seq}`)) seq++;
        const id = `cfg_${seq}`;

        const usedNames = new Set(configs.map(cfg => cfg.name));
        let nameSeq = configs.length + 1;
        let defaultName = `配置 ${nameSeq}`;
        while (usedNames.has(defaultName)) {
            nameSeq++;
            defaultName = `配置 ${nameSeq}`;
        }
        const requestedName = String(body.name || '').trim() || defaultName;
        if (usedNames.has(requestedName)) {
            return err('配置名称已存在');
        }

        configs.push(normalizeOutputConfig({
            id,
            name: requestedName,
            subNames: body.subNames,
            nodeNames: body.nodeNames,
            templateId: body.templateId,
            ruleAppendEnabled: body.ruleAppendEnabled,
            hostsAppendEnabled: body.hostsAppendEnabled
        }, configs.length));
        const saved = await writeOutputConfigs(env, configs);
        const created = saved.find(cfg => cfg.id === id) || saved[saved.length - 1];
        return ok({ configs: saved, config: created });
    }

    if (path === '/api/output/save' && method === 'POST') {
        const idx = configs.findIndex(cfg => cfg.id === body.id);
        if (idx === -1) return err('配置不存在');
        const target = configs[idx];

        if (body.name !== undefined) {
            const nextName = String(body.name || '').trim();
            if (!nextName) return err('配置名称不能为空');
            if (configs.some((cfg, i) => i !== idx && cfg.name === nextName)) {
                return err('配置名称已存在');
            }
            target.name = nextName;
        }
        if (Array.isArray(body.subNames)) {
            target.subNames = Array.from(new Set(body.subNames.map(v => String(v || '').trim()).filter(Boolean)));
        }
        if (Array.isArray(body.nodeNames)) {
            target.nodeNames = Array.from(new Set(body.nodeNames.map(v => String(v || '').trim()).filter(Boolean)));
        }
        if (body.templateId !== undefined) {
            const tplId = String(body.templateId || '').trim();
            if (tplId) {
                const templates = await readTemplates(env);
                if (!templates.some(tpl => tpl.id === tplId)) return err('模板不存在');
            }
            target.templateId = tplId;
        }
        if (body.ruleAppendEnabled !== undefined) {
            target.ruleAppendEnabled = !!body.ruleAppendEnabled;
        }
        if (body.hostsAppendEnabled !== undefined) {
            target.hostsAppendEnabled = !!body.hostsAppendEnabled;
        }

        const saved = await writeOutputConfigs(env, configs);
        return ok({ configs: saved, config: saved[idx] });
    }

    if (path === '/api/output/delete' && method === 'POST') {
        if (configs.length <= 1) return err('至少保留 1 个配置');
        const idx = configs.findIndex(cfg => cfg.id === body.id);
        if (idx === -1) return err('配置不存在');

        const [deleted] = configs.splice(idx, 1);
        if (typeof env.SUBPANEL_KV.delete === 'function') {
            await env.SUBPANEL_KV.delete(`${OUTPUT_CONFIG_CONTENT_PREFIX}${deleted.id}`);
        }
        const saved = await writeOutputConfigs(env, configs);
        return ok({ configs: saved });
    }

    if (path === '/api/output/reset-token' && method === 'POST') {
        const idx = body.id ? configs.findIndex(cfg => cfg.id === body.id) : 0;
        if (idx === -1) return err('配置不存在');

        const usedTokens = new Set(configs.map(cfg => cfg.token));
        let nextToken;
        do {
            nextToken = generateRandomToken(16);
        } while (usedTokens.has(nextToken));

        configs[idx].token = nextToken;
        const saved = await writeOutputConfigs(env, configs);
        return ok({ configs: saved, token: nextToken, config: saved[idx] });
    }

    if (path === '/api/output/generate' && method === 'POST') {
        const idx = body.id ? configs.findIndex(cfg => cfg.id === body.id) : 0;
        if (idx === -1) return err('配置不存在');
        const target = configs[idx];

        // 允许在合成时一并保存当前选择
        if (Array.isArray(body.subNames)) {
            target.subNames = Array.from(new Set(body.subNames.map(v => String(v || '').trim()).filter(Boolean)));
        }
        if (Array.isArray(body.nodeNames)) {
            target.nodeNames = Array.from(new Set(body.nodeNames.map(v => String(v || '').trim()).filter(Boolean)));
        }
        if (body.templateId !== undefined) {
            target.templateId = String(body.templateId || '').trim();
        }
        if (body.ruleAppendEnabled !== undefined) {
            target.ruleAppendEnabled = !!body.ruleAppendEnabled;
        }
        if (body.hostsAppendEnabled !== undefined) {
            target.hostsAppendEnabled = !!body.hostsAppendEnabled;
        }

        if (!target.templateId) {
            return err('请先选择模板');
        }
        if (target.subNames.length === 0 && target.nodeNames.length === 0) {
            return err('请至少选择一个订阅或单节点');
        }

        const built = await rebuildOutputConfig(env, target);
        if (built.error) {
            return err(built.error, 400, built.validation ? { validation: built.validation } : {});
        }

        target.hasGenerated = true;
        target.updatedAt = formatServerTime();
        const saved = await writeOutputConfigs(env, configs);

        return ok({
            success: true,
            configs: saved,
            config: saved[idx],
            skippedRules: built.skippedRules || []
        });
    }

    return err('未知接口', 404);
}

// ====== [MODULE: 12_api_content.js] ======
// ============================================================================
// API 路由（续）：订阅、单节点、模板、规则附加、Hosts 附加、历史兼容
// ============================================================================

// ====== 订阅 ======
async function handleSubRoutes(request, env, path, method, ok, err) {
    const subs = await readSubs(env);

    if (path === '/api/sub/list') return ok(subs);

    let body = {};
    try {
        body = await request.json();
    } catch (e) {
        return err('请求体不是有效 JSON');
    }

    const subIndex = Number(body.index);
    const hasValidIndex = Number.isInteger(subIndex) && subIndex >= 0 && subIndex < subs.length;

    if (path === '/api/sub/delete') {
        if (!hasValidIndex) return err('订阅不存在');
        const [deleted] = subs.splice(subIndex, 1);
        await writeSubs(env, subs);
        await env.SUBPANEL_KV.delete(`${SUBSCRIPTION_CACHE_PREFIX}${deleted.name}`);
        await syncOutputConfigReferences(env, cfg => {
            const before = cfg.subNames.length;
            cfg.subNames = cfg.subNames.filter(name => name !== deleted.name);
            return cfg.subNames.length !== before;
        });
        return ok({ subs });
    }

    if (path === '/api/sub/parse') {
        if (!hasValidIndex) return err('订阅不存在');
        const sub = subs[subIndex];
        if (typeof body.subName !== 'string' || body.subName !== sub.name) {
            return err('订阅信息已变化，请刷新页面');
        }
        if (sub.useProvider) {
            return err('Provider 模式不需要解析节点，请先切换到手动模式');
        }

        const source = String(body.source || 'url');
        if (!['url', 'file', 'text'].includes(source)) {
            return err('不支持的订阅更新来源');
        }

        let result;
        try {
            if (source === 'file') {
                if (typeof body.fileName !== 'string' || !SUBSCRIPTION_FILE_PATTERN.test(body.fileName)) {
                    return err('仅支持 YAML、YML 或 TXT 文件');
                }
                if (typeof body.content !== 'string') {
                    return err('上传文件内容无效');
                }
                result = processSubscriptionContent(body.content, sub.name);
            } else if (source === 'text') {
                if (typeof body.content !== 'string') {
                    return err('粘贴的订阅内容无效');
                }
                result = processSubscriptionContent(body.content, sub.name);
            } else {
                result = await processSubscriptionFromUrl(sub.url, sub.name);
            }
        } catch (e) {
            return err(e.message || '解析失败');
        }

        // 解析期间订阅可能被改名/删除，落盘前重新校验
        const latestSubs = await readSubs(env);
        const latestSub = latestSubs.find(item => item.name === sub.name);
        if (!latestSub || latestSub.useProvider || latestSub.url !== sub.url) {
            return err('订阅信息已变化，请重试');
        }

        await kvPut(env, `${SUBSCRIPTION_CACHE_PREFIX}${sub.name}`, result.content);
        latestSub.lastUpdate = formatServerTime();
        latestSub.nodeCount = result.nodeCount;
        latestSub.lastSource = source;
        await writeSubs(env, latestSubs);

        return ok({
            success: true,
            lastUpdate: latestSub.lastUpdate,
            nodeCount: result.nodeCount,
            source,
            subs: latestSubs
        });
    }

    if (path !== '/api/sub/add' && path !== '/api/sub/update') {
        return err('未知接口', 404);
    }

    // ---- 新增 / 更新 ----
    const name = String(body.name || '').trim();
    const url = String(body.url || '').trim();
    if (!name || !url) return err('名称和订阅链接不能为空');
    if (!/^https?:\/\//i.test(url)) return err('订阅链接必须以 http:// 或 https:// 开头');

    if (path === '/api/sub/update' && !hasValidIndex) return err('订阅不存在');
    if (subs.some((sub, i) => sub.name === name && i !== subIndex)) return err('订阅名称已存在');

    const isUpdate = path === '/api/sub/update';
    if (!isUpdate && subs.length >= MAX_SUBS) return err(`最多保存 ${MAX_SUBS} 个订阅`);

    // 链接未变化时不重复探测
    const sameUrl = isUpdate && subs[subIndex].url === url;
    if (!sameUrl && !body.force) {
        const probe = await probeSubscriptionConnectivity(url);
        if (!probe.ok) {
            return err(`订阅链接无法连通: ${probe.error}`, 400, { confirmationNeeded: true });
        }
    }

    if (!isUpdate) {
        await env.SUBPANEL_KV.delete(`${SUBSCRIPTION_CACHE_PREFIX}${name}`);
        subs.push(normalizeSub({
            name,
            url,
            useProvider: body.useProvider !== undefined ? !!body.useProvider : true,
            autoUpdate: !!body.autoUpdate
        }));
        await writeSubs(env, subs);
        return ok({ subs });
    }

    const oldName = subs[subIndex].name;
    if (oldName !== name) {
        // 改名时同步迁移节点缓存，避免缓存丢失
        const cached = await env.SUBPANEL_KV.get(`${SUBSCRIPTION_CACHE_PREFIX}${oldName}`);
        if (cached !== null && cached !== undefined) {
            await kvPut(env, `${SUBSCRIPTION_CACHE_PREFIX}${name}`, cached);
        }
        await env.SUBPANEL_KV.delete(`${SUBSCRIPTION_CACHE_PREFIX}${oldName}`);
    }

    subs[subIndex] = normalizeSub({
        ...subs[subIndex],
        name,
        url,
        useProvider: body.useProvider !== undefined ? !!body.useProvider : subs[subIndex].useProvider,
        autoUpdate: body.autoUpdate !== undefined ? !!body.autoUpdate : subs[subIndex].autoUpdate
    });
    await writeSubs(env, subs);

    if (oldName !== name) {
        await syncOutputConfigReferences(env, cfg => {
            const idx = cfg.subNames.indexOf(oldName);
            if (idx === -1) return false;
            cfg.subNames[idx] = name;
            cfg.subNames = Array.from(new Set(cfg.subNames));
            return true;
        });
    }

    return ok({ subs });
}

// ====== 单节点 ======
async function handleNodeRoutes(request, env, path, method, ok, err) {
    const nodes = await readNodes(env);

    if (path === '/api/node/list') return ok(nodes);

    let body = {};
    try {
        body = await request.json();
    } catch (e) {
        return err('请求体不是有效 JSON');
    }

    const nodeIndex = Number(body.index);
    const hasValidIndex = Number.isInteger(nodeIndex) && nodeIndex >= 0 && nodeIndex < nodes.length;

    if (path === '/api/node/delete') {
        if (!hasValidIndex) return err('节点不存在');
        const [deleted] = nodes.splice(nodeIndex, 1);
        await writeNodes(env, nodes);
        await syncOutputConfigReferences(env, cfg => {
            const before = cfg.nodeNames.length;
            cfg.nodeNames = cfg.nodeNames.filter(name => name !== deleted.name);
            return cfg.nodeNames.length !== before;
        });
        return ok({ nodes });
    }

    if (path !== '/api/node/add' && path !== '/api/node/update') {
        return err('未知接口', 404);
    }

    const name = String(body.name || '').trim();
    const rawContent = String(body.content || '').trim();
    if (!name) return err('节点名称不能为空');
    if (!rawContent) return err('节点内容不能为空');
    if (path === '/api/node/update' && !hasValidIndex) return err('节点不存在');
    if (nodes.some((node, i) => node.name === name && i !== (path === '/api/node/update' ? nodeIndex : -1))) {
        return err('节点名称已存在');
    }

    let content;
    try {
        content = convertNode(rawContent, name);
    } catch (e) {
        return err(`节点内容解析失败: ${e.message || ''}`);
    }

    if (path === '/api/node/add') {
        if (nodes.length >= MAX_NODES) return err(`最多保存 ${MAX_NODES} 个单节点`);
        nodes.push({ name, content });
        await writeNodes(env, nodes);
        return ok({ nodes });
    }

    const oldName = nodes[nodeIndex].name;
    nodes[nodeIndex] = { name, content };
    await writeNodes(env, nodes);

    if (oldName !== name) {
        await syncOutputConfigReferences(env, cfg => {
            const idx = cfg.nodeNames.indexOf(oldName);
            if (idx === -1) return false;
            cfg.nodeNames[idx] = name;
            cfg.nodeNames = Array.from(new Set(cfg.nodeNames));
            return true;
        });
    }
    return ok({ nodes });
}

// ====== 模板 ======

async function handleTemplateRoutes(request, env, path, method, ok, err) {
    const catalog = await readTemplateCatalog(env);

    if (path === '/api/template/list' && method === 'GET') {
        return ok({ templates: catalog.templates.map(summarizeTemplate) });
    }

    if (path === '/api/template/detail' && method === 'POST') {
        let body = {};
        try {
            body = await request.json();
        } catch (e) {
            return err('请求体不是有效 JSON');
        }
        const id = String(body.id || '');
        const result = await getTemplateContentById(env, id, catalog);
        if (result.error) return err(result.error);
        return ok({ id, content: result.content, groups: extractProxyGroupNames(result.content) });
    }

    let body = {};
    try {
        body = await request.json();
    } catch (e) {
        return err('请求体不是有效 JSON');
    }

    const tplIndex = Number(body.index);
    const tplId = String(body.id || '').trim();
    const findIndex = () => {
        if (Number.isInteger(tplIndex) && tplIndex >= 0 && tplIndex < catalog.templates.length) return tplIndex;
        if (tplId) return catalog.templates.findIndex(t => t.id === tplId);
        return -1;
    };

    if (path === '/api/template/delete' && method === 'POST') {
        const idx = findIndex();
        if (idx === -1) return err('模板不存在');
        const [deleted] = catalog.templates.splice(idx, 1);
        await writeTemplates(env, catalog.templates);

        // 引用被删模板的输出配置变为「未选择模板」：已生成的内容与订阅链接保留，
        // 重新选择模板并合成后才会更新。
        // 绑定该模板的规则保持原样（成为"未绑定"规则，不再生效），由用户在界面上重新指定。
        await syncOutputConfigReferences(env, cfg => {
            if (cfg.templateId !== deleted.id) return false;
            cfg.templateId = '';
            return true;
        });

        const ruleConfig = await readRuleAppendConfig(env);
        const orphaned = ruleConfig.rules.filter(rule => rule.target === deleted.id).length;

        return ok({
            templates: catalog.templates.map(summarizeTemplate),
            orphanedRules: orphaned
        });
    }

    if (path === '/api/template/refresh' && method === 'POST') {
        const idx = findIndex();
        if (idx === -1) return err('模板不存在');
        const tpl = catalog.templates[idx];
        if (tpl.type !== 'url' || !tpl.url) return err('该模板不是 URL 类型，无法刷新');
        const fetched = await fetchAndValidateTemplate(tpl.url);
        if (fetched.error) return err(`刷新失败: ${fetched.error}`);
        tpl.content = fetched.content;
        tpl.updatedAt = formatServerTime();
        await writeTemplates(env, catalog.templates);
        return ok({ templates: catalog.templates.map(summarizeTemplate) });
    }

    if (path !== '/api/template/add' && path !== '/api/template/update') {
        return err('未知接口', 404);
    }

    // ---- 新增 / 更新 ----
    const name = String(body.name || '').trim();
    const rawContent = String(body.content || '').trim();
    if (!name) return err('模板名称不能为空');
    if (!rawContent) return err('模板内容不能为空');
    if (['template0', 'global'].includes(name)) {
        return err('该名称是系统保留名称，请换一个');
    }

    const isUpdate = path === '/api/template/update';
    const idx = isUpdate ? findIndex() : -1;
    if (isUpdate && idx === -1) return err('模板不存在');
    if (catalog.templates.some((t, i) => t.name === name && i !== idx)) return err('模板名称已存在');
    if (!isUpdate && catalog.templates.length >= MAX_TEMPLATES) return err(`最多保存 ${MAX_TEMPLATES} 个模板`);

    let type = 'txt';
    let url = '';
    let content = rawContent;
    let updatedAt = formatServerTime();

    if (/^https?:\/\//i.test(rawContent)) {
        const fetched = await fetchAndValidateTemplate(rawContent);
        if (fetched.error) return err(`模板链接无效: ${fetched.error}`);
        type = 'url';
        url = rawContent;
        content = fetched.content;
    } else {
        const parsed = parseTemplateYaml(content);
        if (!parsed.ok) return err(parsed.error);
    }

    if (isUpdate) {
        const old = catalog.templates[idx];
        // 改名保持 ID 不变，引用自动跟随
        catalog.templates[idx] = {
            id: old.id,
            name,
            type,
            url,
            content,
            updatedAt: updatedAt || old.updatedAt
        };
        await writeTemplates(env, catalog.templates);
        return ok({ templates: catalog.templates.map(summarizeTemplate) });
    }

    // 新模板使用随机稳定 ID：同名重建不会"复活"旧模板遗留的规则绑定
    const usedIds = new Set([MIGRATED_DEFAULT_TEMPLATE_ID, ...catalog.templates.map(t => t.id)]);
    let newId;
    do {
        newId = `${TEMPLATE_ID_PREFIX}${generateRandomToken(10).toLowerCase()}`;
    } while (usedIds.has(newId));
    catalog.templates.push({ id: newId, name, type, url, content, updatedAt });
    await writeTemplates(env, catalog.templates);
    return ok({ templates: catalog.templates.map(summarizeTemplate), id: newId });
}

// ====== 规则附加 ======
/**
 * 规则附加只有两个接口：
 *   GET  /api/rule-append/get   读取
 *   POST /api/rule-append/save  整体保存（前端暂存全部修改后一次提交，只写 1 次 KV）
 * 保存时携带加载时的 revision，期间如有其他设备保存过则拒绝覆盖（409）。
 */
async function handleRuleAppendRoutes(request, env, path, method, ok, err) {
    const catalog = await readTemplateCatalog(env);

    if (path === '/api/rule-append/get' && method === 'GET') {
        const config = await readRuleAppendConfig(env);
        return ok({
            config,
            allGroups: catalog.allGroups,
            groupsByTemplate: catalog.groupsByTemplate
        });
    }

    if (path === '/api/rule-append/save' && method === 'POST') {
        let body = {};
        try {
            body = await request.json();
        } catch (e) {
            return err('请求体不是有效 JSON');
        }

        const stored = await readRuleAppendConfig(env);
        const baseRevision = Number(body.baseRevision);
        if (!Number.isFinite(baseRevision) || baseRevision !== stored.revision) {
            return err('规则已在其他地方被修改，请刷新页面后重新编辑（当前未保存的修改将丢失）', 409, {
                conflict: true,
                config: stored
            });
        }

        const validation = validateRuleSet(body.rules, stored.rules, catalog);
        if (!validation.ok) {
            const first = validation.errors[0];
            const prefix = first.index >= 0 ? `第 ${first.index + 1} 条规则：` : '';
            return err(`${prefix}${first.error}`, 400, { errors: validation.errors });
        }

        const saved = await writeRuleAppendConfig(env, { ...stored, rules: validation.rules });
        return ok({
            config: saved,
            allGroups: catalog.allGroups,
            groupsByTemplate: catalog.groupsByTemplate
        });
    }

    return err('未知接口', 404);
}

// ====== Hosts 附加 ======
async function handleHostsAppendRoutes(request, env, path, method, ok, err) {
    if (path === '/api/hosts-append/get' && method === 'GET') {
        const config = await readHostsAppendConfig(env);
        return ok({ config: presentHostsConfig(config) });
    }

    let body = {};
    try {
        body = await request.json();
    } catch (e) {
        return err('请求体不是有效 JSON');
    }
    const existing = await readHostsAppendConfig(env);

    if (path === '/api/hosts-append/save' && method === 'POST') {
        const ipFilter = HOSTS_IP_FILTERS.includes(body.ipFilter) ? body.ipFilter : existing.ipFilter;
        const validation = validateStaticHostsContent(body.staticContent || '');
        if (!validation.ok) {
            return err(validation.errors[0] || '静态 Hosts 校验失败', 400, { validation });
        }
        const saved = await writeHostsAppendConfig(env, {
            ...existing,
            ipFilter,
            staticContent: validation.normalizedContent
        });
        return ok({ config: presentHostsConfig(saved), validation });
    }

    if (path === '/api/hosts-append/clear' && method === 'POST') {
        const saved = await writeHostsAppendConfig(env, { ...existing, staticContent: '' });
        return ok({ config: presentHostsConfig(saved), validation: { ok: true, errors: [], normalizedContent: '', entries: [] } });
    }

    if (path === '/api/hosts-append/sub/save' && method === 'POST') {
        const name = String(body.name || '').trim();
        const rawUrl = String(body.url || '').trim();
        const subIndex = Number(body.index);
        const isEditing = Number.isInteger(subIndex) && subIndex >= 0 && subIndex < existing.subs.length;

        if (Number.isInteger(subIndex) && subIndex >= 0 && !isEditing) return err('Hosts 订阅不存在');
        if (!name) return err('订阅名称不能为空');
        if (!isEditing && !rawUrl) return err('订阅链接不能为空');

        const finalUrl = isEditing && !rawUrl ? existing.subs[subIndex].url : rawUrl;
        if (!/^https?:\/\//i.test(finalUrl)) return err('订阅链接必须以 http:// 或 https:// 开头');
        if (existing.subs.some((sub, i) => sub.name === name && i !== (isEditing ? subIndex : -1))) {
            return err('Hosts 订阅名称已存在');
        }
        if (!isEditing && existing.subs.length >= MAX_HOSTS_SUBS) {
            return err(`最多保存 ${MAX_HOSTS_SUBS} 个 Hosts 订阅`);
        }

        const needFetch = !isEditing || existing.subs[subIndex].url !== finalUrl || existing.subs[subIndex].entries.length === 0;
        let entries = isEditing ? existing.subs[subIndex].entries : [];
        let updatedAt = isEditing ? existing.subs[subIndex].updatedAt : '';
        let updatedAtMs = isEditing ? existing.subs[subIndex].updatedAtMs : 0;
        const nowMs = Date.now();

        if (needFetch) {
            try {
                entries = await fetchHostsSubscription(finalUrl);
                updatedAt = formatServerTime(nowMs);
                updatedAtMs = nowMs;
            } catch (e) {
                return err(`Hosts 订阅解析失败: ${e.message || ''}`);
            }
        }

        const nextSub = normalizeHostsSub({
            name,
            url: finalUrl,
            autoUpdate: body.autoUpdate !== undefined
                ? !!body.autoUpdate
                : (isEditing ? existing.subs[subIndex].autoUpdate : false),
            entries,
            updatedAt,
            updatedAtMs,
            lastAttemptAtMs: nowMs,
            lastError: ''
        });

        const nextSubs = [...existing.subs];
        if (isEditing) {
            nextSubs[subIndex] = nextSub;
        } else {
            nextSubs.push(nextSub);
        }
        const saved = await writeHostsAppendConfig(env, { ...existing, subs: nextSubs });
        return ok({ config: presentHostsConfig(saved) });
    }

    if (path === '/api/hosts-append/sub/detail' && method === 'POST') {
        const subIndex = Number(body.index);
        if (!Number.isInteger(subIndex) || subIndex < 0 || subIndex >= existing.subs.length) {
            return err('Hosts 订阅不存在');
        }
        const sub = existing.subs[subIndex];
        return ok({
            name: sub.name,
            updatedAt: sub.updatedAt,
            ipFilter: existing.ipFilter,
            entries: sub.entries,
            // 按当前 IP 筛选后实际会写入配置的条目数
            effectiveCount: filterHostsEntries(sub.entries, existing.ipFilter).length
        });
    }

    if (path === '/api/hosts-append/sub/refresh' && method === 'POST') {
        const subIndex = Number(body.index);
        if (!Number.isInteger(subIndex) || subIndex < 0 || subIndex >= existing.subs.length) {
            return err('Hosts 订阅不存在');
        }
        const target = existing.subs[subIndex];
        let entries;
        try {
            entries = await fetchHostsSubscription(target.url);
        } catch (e) {
            return err(`刷新失败（已保留原数据）: ${e.message || ''}`);
        }
        const nowMs = Date.now();
        const nextSubs = [...existing.subs];
        nextSubs[subIndex] = normalizeHostsSub({
            ...target,
            entries,
            updatedAt: formatServerTime(nowMs),
            updatedAtMs: nowMs,
            lastAttemptAtMs: nowMs,
            lastError: ''
        });
        const saved = await writeHostsAppendConfig(env, { ...existing, subs: nextSubs });
        return ok({ config: presentHostsConfig(saved), domainCount: entries.length });
    }

    if (path === '/api/hosts-append/sub/toggle-auto' && method === 'POST') {
        const subIndex = Number(body.index);
        if (!Number.isInteger(subIndex) || subIndex < 0 || subIndex >= existing.subs.length) {
            return err('Hosts 订阅不存在');
        }
        const nextSubs = [...existing.subs];
        nextSubs[subIndex] = { ...nextSubs[subIndex], autoUpdate: !!body.autoUpdate };
        const saved = await writeHostsAppendConfig(env, { ...existing, subs: nextSubs });
        return ok({ config: presentHostsConfig(saved) });
    }

    if (path === '/api/hosts-append/sub/delete' && method === 'POST') {
        const subIndex = Number(body.index);
        if (!Number.isInteger(subIndex) || subIndex < 0 || subIndex >= existing.subs.length) {
            return err('Hosts 订阅不存在');
        }
        const nextSubs = [...existing.subs];
        nextSubs.splice(subIndex, 1);
        const saved = await writeHostsAppendConfig(env, { ...existing, subs: nextSubs });
        return ok({ config: presentHostsConfig(saved) });
    }

    return err('未知接口', 404);
}

// ====== 历史兼容 /api/merge ======
async function handleMerge(request, env, ok, err) {
    let body = {};
    try {
        body = await request.json();
    } catch (e) {
        return err('请求体不是有效 JSON');
    }

    const configs = await readOutputConfigs(env);
    const target = body.id ? configs.find(cfg => cfg.id === body.id) : configs[0];
    if (!target) return err('目标配置不存在');

    if (Array.isArray(body.sub_names)) target.subNames = body.sub_names.map(String).filter(Boolean);
    if (Array.isArray(body.node_names)) target.nodeNames = body.node_names.map(String).filter(Boolean);
    if (body.template_id) target.templateId = String(body.template_id);
    if (body.rule_append_enabled !== undefined) target.ruleAppendEnabled = !!body.rule_append_enabled;
    if (body.hosts_append_enabled !== undefined) target.hostsAppendEnabled = !!body.hosts_append_enabled;

    if (!target.templateId) return err('请先选择模板');
    if (target.subNames.length === 0 && target.nodeNames.length === 0) {
        return err('请至少选择一个订阅或单节点');
    }

    const built = await rebuildOutputConfig(env, target);
    if (built.error) return err(built.error);

    target.hasGenerated = true;
    target.updatedAt = formatServerTime();
    const saved = await writeOutputConfigs(env, configs);
    return ok({ success: true, configs: saved, skippedRules: built.skippedRules || [] });
}

// ====== [MODULE: 13_client_html.js] ======
// ============================================================================
// 前端页面结构（HTML）
// 说明：脚本部分通过 __CLIENT_SCRIPT__ 占位符注入，避免在模板字符串里转义反引号。
// ============================================================================

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="color-scheme" content="light dark">
    <title>SubPanel · Mihomo 配置托管</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M50 10L85 30V70L50 90L15 70V30L50 10Z' fill='%232563EB'/%3E%3Cpath d='M40 35L30 50L40 65' stroke='white' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M60 35L70 50L60 65' stroke='white' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='50' cy='50' r='3' fill='white'/%3E%3C/svg%3E">
    <script defer src="/assets/alpine.min.js"></script>
    <style>
        :root {
            --bg: #f6f7f9;
            --surface: #ffffff;
            --surface-2: #f2f4f7;
            --surface-3: #e9edf3;
            --border: #e2e6ee;
            --border-strong: #cfd6e2;
            --text: #14181f;
            --text-2: #4a5464;
            --text-3: #5f6a7b;
            --accent: #2563eb;
            --accent-hover: #1d4ed8;
            --accent-soft: #eaf0fe;
            --accent-solid: #2563eb;
            --accent-solid-hover: #1d4ed8;
            --on-accent: #ffffff;
            --accent-text: #1640a8;
            --danger: #9a1f0e;
            --danger-soft: #fdecea;
            --success: #12663a;
            --success-soft: #e7f6ed;
            --warn: #7d4a00;
            --warn-soft: #fdf3e2;
            --tag0-bg: #e6eefd; --tag0-fg: #1a419c;
            --tag1-bg: #efe9fd; --tag1-fg: #532aa6;
            --tag2-bg: #e1f4f0; --tag2-fg: #0c5a50;
            --tag3-bg: #fbefd9; --tag3-fg: #6e3d00;
            --tag4-bg: #fce7ed; --tag4-fg: #8f1a3f;
            --tag5-bg: #eaedf2; --tag5-fg: #343e4e;
            --radius: 12px;
            --radius-sm: 8px;
            --shadow: 0 1px 2px rgba(16, 24, 40, .05), 0 1px 3px rgba(16, 24, 40, .06);
            --shadow-lg: 0 12px 32px rgba(16, 24, 40, .14);
            --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        }
        @media (prefers-color-scheme: dark) {
            :root:not([data-theme="light"]) {
                --bg: #0f1319;
                --surface: #161b23;
                --surface-2: #1c222c;
                --surface-3: #232b37;
                --border: #272f3c;
                --border-strong: #39424f;
                --text: #e8ecf3;
                --text-2: #d0d7e1;
                --text-3: #bcc5d1;
                --accent: #7aa5f7;
                --accent-hover: #9dbcf9;
                --accent-soft: #1a2740;
                --accent-solid: #2a5bc7;
                --accent-solid-hover: #2350b0;
                --accent-text: #c9dafd;
                --danger: #fcc2ba;
                --danger-soft: #2e1a19;
                --success: #86dcac;
                --success-soft: #12271b;
                --warn: #f5d29a;
                --warn-soft: #2a2013;
                --tag0-bg: #1c2a47; --tag0-fg: #c3d5fc;
                --tag1-bg: #2a2145; --tag1-fg: #dccdfc;
                --tag2-bg: #13302b; --tag2-fg: #ade9de;
                --tag3-bg: #33260f; --tag3-fg: #f4d59f;
                --tag4-bg: #3a1824; --tag4-fg: #f9c3d2;
                --tag5-bg: #252c37; --tag5-fg: #d2d9e3;
                --shadow: 0 1px 2px rgba(0, 0, 0, .4);
                --shadow-lg: 0 16px 40px rgba(0, 0, 0, .55);
            }
        }
        :root[data-theme="dark"] {
            --bg: #0f1319;
            --surface: #161b23;
            --surface-2: #1c222c;
            --surface-3: #232b37;
            --border: #272f3c;
            --border-strong: #39424f;
            --text: #e8ecf3;
            --text-2: #d0d7e1;
            --text-3: #bcc5d1;
            --accent: #7aa5f7;
            --accent-hover: #9dbcf9;
            --accent-soft: #1a2740;
            --accent-solid: #2a5bc7;
            --accent-solid-hover: #2350b0;
            --accent-text: #c9dafd;
            --danger: #fcc2ba;
            --danger-soft: #2e1a19;
            --success: #86dcac;
            --success-soft: #12271b;
            --warn: #f5d29a;
            --warn-soft: #2a2013;
            --tag0-bg: #1c2a47; --tag0-fg: #c3d5fc;
            --tag1-bg: #2a2145; --tag1-fg: #dccdfc;
            --tag2-bg: #13302b; --tag2-fg: #ade9de;
            --tag3-bg: #33260f; --tag3-fg: #f4d59f;
            --tag4-bg: #3a1824; --tag4-fg: #f9c3d2;
            --tag5-bg: #252c37; --tag5-fg: #d2d9e3;
            --shadow: 0 1px 2px rgba(0, 0, 0, .4);
            --shadow-lg: 0 16px 40px rgba(0, 0, 0, .55);
        }

        * { box-sizing: border-box; }
        [x-cloak] { display: none !important; }
        html, body { margin: 0; padding: 0; }
        body {
            background: var(--bg);
            color: var(--text);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
            font-size: 14px;
            line-height: 1.55;
            -webkit-font-smoothing: antialiased;
        }
        h1, h2, h3, h4 { margin: 0; font-weight: 600; line-height: 1.3; }
        p { margin: 0; }
        a { color: var(--accent); text-decoration: none; }
        a:hover { text-decoration: underline; }
        button { font: inherit; cursor: pointer; }
        input, select, textarea { font: inherit; color: inherit; }
        svg { display: block; }

        /* ---------- 布局 ---------- */
        .app { display: flex; min-height: 100dvh; }
        .sidebar {
            display: none;
            width: 232px;
            flex: 0 0 232px;
            background: var(--surface);
            border-right: 1px solid var(--border);
            padding: 18px 12px;
            position: sticky;
            top: 0;
            height: 100dvh;
            flex-direction: column;
            gap: 4px;
        }
        .brand { display: flex; align-items: center; gap: 9px; padding: 4px 8px 18px; }
        .brand-name { font-size: 15px; font-weight: 650; letter-spacing: -.01em; }
        .brand-tag {
            font-size: 10px; padding: 1px 6px; border-radius: 999px;
            background: var(--accent-soft); color: var(--accent-text); font-weight: 600;
        }
        .nav-item {
            display: flex; align-items: center; gap: 10px;
            padding: 9px 11px; border-radius: var(--radius-sm);
            color: var(--text-2); background: transparent; border: 0;
            width: 100%; text-align: left; font-size: 13.5px; font-weight: 500;
            transition: background .12s ease, color .12s ease;
        }
        .nav-item:hover { background: var(--surface-2); color: var(--text); }
        .nav-item.active { background: var(--accent-soft); color: var(--accent-text); font-weight: 600; }
        .nav-item:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
        .nav-badge {
            margin-left: auto; font-size: 10.5px; font-weight: 700;
            background: var(--surface-3); color: var(--text-2);
            padding: 1px 6px; border-radius: 999px;
        }
        .sidebar-foot { margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border); }

        .main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .topbar {
            display: flex; align-items: center; gap: 12px;
            padding: 12px 16px;
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            position: sticky; top: 0; z-index: 20;
        }
        .topbar-title { font-size: 15px; font-weight: 650; }
        .topbar-sub { font-size: 11.5px; color: var(--text-3); }
        .content { padding: 16px; padding-bottom: 88px; flex: 1; }
        .page { max-width: 940px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }

        .bottom-nav {
            position: fixed; bottom: 0; left: 0; right: 0; z-index: 30;
            display: grid; grid-template-columns: repeat(5, 1fr);
            background: var(--surface);
            border-top: 1px solid var(--border);
            padding-bottom: env(safe-area-inset-bottom, 0);
        }
        .bottom-item {
            display: flex; flex-direction: column; align-items: center; gap: 2px;
            padding: 8px 2px 7px; border: 0; background: transparent;
            color: var(--text-3); font-size: 10.5px; font-weight: 500;
        }
        .bottom-item.active { color: var(--accent); font-weight: 650; }
        .bottom-item:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

        @media (min-width: 768px) {
            .sidebar { display: flex; }
            .bottom-nav { display: none; }
            .content { padding: 22px 26px 40px; }
            .topbar { padding: 14px 26px; }
        }

        /* ---------- 卡片与区块 ---------- */
        .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            box-shadow: var(--shadow);
            overflow: hidden;
        }
        .card-head {
            display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
            padding: 13px 15px; border-bottom: 1px solid var(--border);
        }
        .card-title { font-size: 13.5px; font-weight: 650; }
        .card-body { padding: 15px; }
        .card-body.flush { padding: 0; }
        .spacer { margin-left: auto; }

        .section-label {
            font-size: 11px; font-weight: 700; letter-spacing: .06em;
            text-transform: uppercase; color: var(--text-3);
            margin-bottom: 8px;
        }

        /* ---------- 表单控件 ---------- */
        .field { display: flex; flex-direction: column; gap: 5px; }
        .label { font-size: 12px; font-weight: 600; color: var(--text-2); }
        .hint { font-size: 11.5px; color: var(--text-3); }
        .input, .select, .textarea {
            width: 100%; padding: 8px 10px;
            background: var(--surface);
            border: 1px solid var(--border-strong);
            border-radius: var(--radius-sm);
            font-size: 13.5px;
            transition: border-color .12s ease, box-shadow .12s ease;
        }
        .input:focus, .select:focus, .textarea:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-soft);
        }
        .input:disabled, .select:disabled, .textarea:disabled {
            background: var(--surface-2); color: var(--text-3); cursor: not-allowed;
        }
        .textarea { font-family: var(--mono); font-size: 12.5px; line-height: 1.6; resize: vertical; min-height: 84px; }
        .select { appearance: none; background-image: none; padding-right: 30px; }
        .select-wrap { position: relative; }
        .select-wrap::after {
            content: ""; position: absolute; right: 11px; top: 50%;
            width: 6px; height: 6px; margin-top: -4px;
            border-right: 1.5px solid var(--text-3); border-bottom: 1.5px solid var(--text-3);
            transform: rotate(45deg); pointer-events: none;
        }
        .check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
        .check input { width: 15px; height: 15px; accent-color: var(--accent); cursor: pointer; margin: 0; }
        .grid-2 { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 620px) { .grid-2 { grid-template-columns: 1fr 1fr; } }
        .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

        /* ---------- 按钮 ---------- */
        .btn {
            display: inline-flex; align-items: center; justify-content: center; gap: 6px;
            padding: 7px 13px; border-radius: var(--radius-sm);
            border: 1px solid var(--border-strong);
            background: var(--surface); color: var(--text);
            font-size: 13px; font-weight: 550;
            transition: background .12s ease, border-color .12s ease, opacity .12s ease;
            white-space: nowrap;
        }
        .btn:hover:not(:disabled) { background: var(--surface-2); border-color: var(--text-3); }
        .btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
        .btn:disabled { opacity: .5; cursor: not-allowed; }
        .btn-primary {
            background: var(--accent-solid); border-color: var(--accent-solid); color: var(--on-accent);
        }
        .btn-primary:hover:not(:disabled) { background: var(--accent-solid-hover); border-color: var(--accent-solid-hover); }
        .btn-danger { color: var(--danger); border-color: var(--border-strong); }
        .btn-danger:hover:not(:disabled) { background: var(--danger-soft); border-color: var(--danger); }
        .btn-ghost { border-color: transparent; background: transparent; color: var(--text-2); }
        .btn-ghost:hover:not(:disabled) { background: var(--surface-2); }
        .btn-sm { padding: 4px 9px; font-size: 12px; }
        .btn-block { width: 100%; }

        /* ---------- 徽章与提示 ---------- */
        .badge {
            display: inline-flex; align-items: center; gap: 4px;
            font-size: 11px; font-weight: 600;
            padding: 2px 7px; border-radius: 999px;
            background: var(--surface-3); color: var(--text-2);
        }
        .badge-ok { background: var(--success-soft); color: var(--success); }
        .badge-warn { background: var(--warn-soft); color: var(--warn); }
        .badge-err { background: var(--danger-soft); color: var(--danger); }
        .badge-accent { background: var(--accent-soft); color: var(--accent-text); }
        .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: 0 0 auto; }

        .alert {
            display: flex; gap: 9px; align-items: flex-start;
            padding: 10px 12px; border-radius: var(--radius-sm);
            font-size: 12.5px; border: 1px solid transparent;
        }
        .alert-err { background: var(--danger-soft); color: var(--danger); border-color: color-mix(in srgb, var(--danger) 25%, transparent); }
        .alert-ok { background: var(--success-soft); color: var(--success); border-color: color-mix(in srgb, var(--success) 25%, transparent); }
        .alert-warn { background: var(--warn-soft); color: var(--warn); border-color: color-mix(in srgb, var(--warn) 25%, transparent); }
        .alert-info { background: var(--accent-soft); color: var(--accent-text); border-color: color-mix(in srgb, var(--accent) 22%, transparent); }

        .empty {
            padding: 26px 14px; text-align: center;
            color: var(--text-3); font-size: 12.5px;
        }

        /* ---------- 列表项 ---------- */
        .item {
            display: flex; align-items: flex-start; gap: 11px;
            padding: 11px 15px;
            border-bottom: 1px solid var(--border);
        }
        .item:last-child { border-bottom: 0; }
        .item:hover { background: var(--surface-2); }
        .item-main { min-width: 0; flex: 1; }
        .item-title { font-size: 13.5px; font-weight: 600; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
        .item-meta { font-size: 11.5px; color: var(--text-3); margin-top: 3px; word-break: break-all; }
        .item-actions { display: flex; gap: 5px; flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; }
        .mono { font-family: var(--mono); font-size: 12px; }

        /* ---------- 分段控件 ---------- */
        .segmented {
            display: inline-flex; padding: 3px; gap: 2px;
            background: var(--surface-2); border-radius: var(--radius-sm);
            border: 1px solid var(--border);
        }
        .segmented button {
            padding: 5px 12px; border: 0; background: transparent;
            border-radius: 6px; font-size: 12.5px; font-weight: 550; color: var(--text-2);
        }
        .segmented button.active { background: var(--surface); color: var(--text); box-shadow: var(--shadow); }
        .segmented button:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }

        /* ---------- 规则表 ---------- */
        .rule-list { display: flex; flex-direction: column; position: relative; }
        .rule-row {
            display: grid;
            grid-template-columns: auto auto minmax(0, 1fr);
            gap: 6px 8px;
            padding: 10px 14px 10px 8px;
            border-bottom: 1px solid var(--border);
            border-left: 3px solid transparent;
            align-items: start;
            background: var(--surface);
        }
        .rule-row:last-child { border-bottom: 0; }
        .rule-row .rule-actions { grid-column: 3; }
        @media (min-width: 620px) {
            .rule-row { grid-template-columns: auto auto minmax(0, 1fr) auto; }
            .rule-row .rule-actions { grid-column: 4; }
        }
        .rule-row.is-new { border-left-color: var(--success); }
        .rule-row.is-modified { border-left-color: var(--accent); }
        .rule-row.is-invalid { border-left-color: var(--danger); }
        .rule-row.is-editing { background: var(--accent-soft); }
        .rule-row.is-deleted .rule-code,
        .rule-row.is-deleted .rule-tags { opacity: .55; }
        .rule-row.is-deleted .rule-code { text-decoration: line-through; }
        .rule-row.is-disabled .rule-code { opacity: .55; }
        /* 拖动态：原行留在原位淡出，仅显示紧凑半透明预览条 */
        .rule-row.is-dragging {
            background: var(--surface-2);
            box-shadow: inset 0 0 0 1px var(--border-strong);
        }
        .rule-row.is-dragging .rule-code,
        .rule-row.is-dragging .rule-tags,
        .rule-row.is-dragging .rule-msg,
        .rule-row.is-dragging .rule-actions,
        .rule-row.is-dragging .rule-index,
        .rule-row.is-dragging .drag-handle { opacity: .3; }

        /* 插入位置指示线（拖动时显示） */
        #rule-drag-indicator {
            position: absolute; left: 0; right: 0; top: 0;
            height: 2px; margin-top: -1px;
            background: var(--accent);
            border-radius: 2px;
            opacity: 0; pointer-events: none;
            z-index: 6;
            transition: transform .08s ease-out, opacity .12s ease;
        }
        #rule-drag-indicator.is-active { opacity: 1; }
        #rule-drag-indicator::before,
        #rule-drag-indicator::after {
            content: ""; position: absolute; top: 50%;
            width: 7px; height: 7px; margin-top: -3.5px;
            border-radius: 50%; background: var(--accent);
        }
        #rule-drag-indicator::before { left: -3px; }
        #rule-drag-indicator::after { right: -3px; }

        .rule-drop-label {
            position: absolute; right: 10px; bottom: 7px;
            padding: 2px 7px; border-radius: 5px;
            background: var(--accent-solid); color: var(--on-accent);
            font-size: 11px; font-weight: 600; white-space: nowrap;
        }

        /* 轻量预览条：只展示序号、规则摘要与落点；背景透明，文字不跟着淡化。 */
        #rule-drag-layer {
            position: fixed; inset: 0; z-index: 70;
            pointer-events: none;
        }
        .rule-drag-preview {
            position: fixed; left: 0; top: 0;
            display: flex; align-items: center; gap: 8px;
            width: min(320px, 70vw); height: 34px;
            padding: 0 10px; border-radius: 8px;
            background: var(--surface);
            background: color-mix(in srgb, var(--surface) 72%, transparent);
            color: var(--text); border: 1px solid var(--border-strong);
            box-shadow: var(--shadow);
            pointer-events: none; will-change: transform;
            font-size: 11.5px; line-height: 1.4;
        }
        .rule-drag-source { flex-shrink: 0; font-weight: 650; font-variant-numeric: tabular-nums; }
        .rule-drag-summary {
            flex: 1; min-width: 0; font-family: var(--mono);
            overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
        }
        .rule-drag-destination {
            flex-shrink: 0; color: var(--text); font-weight: 650;
            font-variant-numeric: tabular-nums; white-space: nowrap;
        }
        @media (prefers-reduced-motion: reduce) {
            #rule-drag-indicator { transition: none; }
        }
        .drag-handle {
            width: 24px; height: 28px; padding: 0;
            display: flex; align-items: center; justify-content: center;
            border: 0; border-radius: 6px; background: transparent;
            color: var(--text-3); font-size: 16px; line-height: 1;
            cursor: grab; touch-action: none;
        }
        .drag-handle:hover:not(:disabled) { background: var(--surface-3); color: var(--text); }
        .drag-handle:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
        .drag-handle:disabled { cursor: default; opacity: .35; }
        body.is-dragging-rule, body.is-dragging-rule * { cursor: grabbing !important; user-select: none; }
        body.is-dragging-rule { overflow-x: hidden; }
        .rule-index {
            min-width: 20px; padding-top: 5px; text-align: right;
            font-size: 11.5px; font-weight: 650; color: var(--text-3);
            font-variant-numeric: tabular-nums;
        }
        .rule-body { min-width: 0; padding-top: 3px; }
        .rule-code {
            font-family: var(--mono); font-size: 12px;
            word-break: break-all; color: var(--text);
        }
        .rule-tags { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 6px; align-items: center; }
        .rule-msg { font-size: 11.5px; margin-top: 5px; line-height: 1.45; }
        .rule-msg.warn { color: var(--warn); }
        .rule-msg.err { color: var(--danger); font-weight: 550; }
        .rule-actions { display: flex; gap: 4px; flex-wrap: wrap; }
        .rule-actions .btn { padding: 3px 8px; font-size: 11.5px; }
        .chip {
            font-size: 10.5px; font-weight: 600; padding: 1px 6px;
            border-radius: 5px; background: var(--surface-3); color: var(--text-2);
        }
        .chip-policy { background: var(--surface-2); color: var(--text-2); font-family: var(--mono); border: 1px solid var(--border); }
        .chip-new { background: var(--success-soft); color: var(--success); }
        .chip-mod { background: var(--accent-soft); color: var(--accent-text); }
        .chip-del { background: var(--danger-soft); color: var(--danger); }

        /* ---------- 模板标签 ---------- */
        .tpl-tag {
            display: inline-flex; align-items: center;
            font-size: 10.5px; font-weight: 650; line-height: 1.55;
            padding: 0 7px; border-radius: 999px; white-space: nowrap;
            max-width: 160px; overflow: hidden; text-overflow: ellipsis;
        }
        .tpl-c0 { background: var(--tag0-bg); color: var(--tag0-fg); }
        .tpl-c1 { background: var(--tag1-bg); color: var(--tag1-fg); }
        .tpl-c2 { background: var(--tag2-bg); color: var(--tag2-fg); }
        .tpl-c3 { background: var(--tag3-bg); color: var(--tag3-fg); }
        .tpl-c4 { background: var(--tag4-bg); color: var(--tag4-fg); }
        .tpl-c5 { background: var(--tag5-bg); color: var(--tag5-fg); }
        .tag-global { background: var(--surface-3); color: var(--text); }
        .tag-orphan { background: var(--warn-soft); color: var(--warn); }
        .owner-tags { display: flex; gap: 4px; flex-wrap: wrap; min-width: 0; }

        /* ---------- 策略组选择器 ---------- */
        .picker { position: relative; }
        .picker-trigger {
            width: 100%; min-height: 37px;
            display: flex; align-items: center; gap: 8px;
            padding: 6px 32px 6px 10px; position: relative;
            background: var(--surface); color: var(--text);
            border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
            text-align: left; font-size: 13.5px;
        }
        .picker-trigger:focus-visible, .picker-trigger.is-open {
            outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft);
        }
        .picker-trigger.is-invalid { border-color: var(--danger); }
        .picker-value { font-family: var(--mono); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .picker-caret {
            position: absolute; right: 12px; top: 50%;
            width: 6px; height: 6px; margin-top: -4px;
            border-right: 1.5px solid var(--text-3); border-bottom: 1.5px solid var(--text-3);
            transform: rotate(45deg); pointer-events: none;
        }
        .picker-panel {
            position: absolute; z-index: 40; left: 0; right: 0; top: calc(100% + 4px);
            min-width: min(100%, 320px);
            background: var(--surface); border: 1px solid var(--border-strong);
            border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); padding: 6px;
        }
        .picker-search { margin-bottom: 4px; padding: 6px 9px; font-size: 12.5px; }
        .picker-list { max-height: 290px; overflow: auto; overscroll-behavior: contain; }
        .picker-section {
            padding: 8px 8px 3px; font-size: 10.5px; font-weight: 700;
            letter-spacing: .06em; color: var(--text-3);
        }
        .picker-option {
            width: 100%; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
            padding: 7px 8px; border: 0; border-radius: 6px;
            background: transparent; color: var(--text); text-align: left; font-size: 13px;
        }
        .picker-option.is-active { background: var(--surface-3); }
        .picker-option-name { font-family: var(--mono); font-size: 12.5px; }
        .picker-option.is-selected .picker-option-name { color: var(--accent-text); font-weight: 700; }
        .picker-option.is-selected .picker-option-name::before { content: "✓ "; }
        .picker-option .owner-tags { margin-left: auto; justify-content: flex-end; }
        .picker-empty { padding: 14px 8px; text-align: center; color: var(--text-3); font-size: 12px; }
        .card-overflow { overflow: visible; }

        /* ---------- 未保存提示条 ---------- */
        .unsaved-bar {
            position: sticky; bottom: 72px; z-index: 25;
            display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
            padding: 10px 12px 10px 14px;
            background: var(--surface); color: var(--text);
            border: 1px solid var(--accent); border-radius: var(--radius);
            box-shadow: var(--shadow-lg); font-size: 13px; font-weight: 600;
        }
        @media (min-width: 768px) { .unsaved-bar { bottom: 16px; } }
        .unsaved-bar .dot { color: var(--accent); }
        .unsaved-bar .bar-note { font-weight: 500; color: var(--danger); }

        /* ---------- 订阅卡片 ---------- */
        .sub-item { flex-wrap: wrap; }
        .item-side { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; width: 100%; }
        .item-side .item-actions { justify-content: flex-start; }
        @media (min-width: 620px) {
            .item-side { width: auto; align-items: flex-end; }
            .item-side .item-actions { justify-content: flex-end; }
        }
        .segmented-sm button { padding: 4px 10px; font-size: 12px; }
        .segmented button:disabled { cursor: not-allowed; opacity: .6; }
        .info-btn {
            width: 22px; height: 22px; padding: 0; border-radius: 50%;
            display: inline-flex; align-items: center; justify-content: center;
            border: 1px solid var(--border-strong); background: transparent;
            color: var(--text-2); font-size: 12px; font-weight: 700; font-family: Georgia, serif;
        }
        .info-btn:hover, .info-btn[aria-expanded="true"] { background: var(--surface-2); color: var(--text); }
        .info-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
        .help-panel {
            display: grid; gap: 6px; padding: 11px 15px;
            background: var(--surface-2); border-bottom: 1px solid var(--border);
            font-size: 12.5px; color: var(--text-2);
        }
        .help-panel b { color: var(--text); }
        .counter { font-size: 11.5px; color: var(--text-3); font-variant-numeric: tabular-nums; }
        .counter.over { color: var(--danger); font-weight: 650; }
        .field-head { display: flex; align-items: baseline; gap: 8px; }
        .field-head .counter { margin-left: auto; }

        /* ---------- 弹窗 / 抽屉 ---------- */
        .overlay {
            position: fixed; inset: 0; z-index: 60;
            background: rgba(8, 12, 20, .48);
            display: flex; align-items: flex-end; justify-content: center;
        }
        @media (min-width: 768px) {
            .overlay { align-items: center; }
        }
        .dialog {
            background: var(--surface);
            border: 1px solid var(--border);
            width: 100%; max-width: 560px;
            max-height: 92dvh; overflow: auto;
            border-radius: var(--radius) var(--radius) 0 0;
            box-shadow: var(--shadow-lg);
            display: flex; flex-direction: column;
        }
        @media (min-width: 768px) {
            .dialog { border-radius: var(--radius); max-height: 88dvh; }
        }
        .dialog-head {
            display: flex; align-items: center; gap: 10px;
            padding: 14px 16px; border-bottom: 1px solid var(--border);
            position: sticky; top: 0; background: var(--surface); z-index: 1;
        }
        .dialog-body { padding: 16px; display: flex; flex-direction: column; gap: 13px; }
        .dialog-foot {
            display: flex; gap: 8px; justify-content: flex-end;
            padding: 13px 16px; border-top: 1px solid var(--border);
            background: var(--surface); position: sticky; bottom: 0;
        }

        /* ---------- 登录 ---------- */
        .login-wrap {
            position: fixed; inset: 0; z-index: 80;
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
            background: var(--bg);
        }
        .login-card {
            width: 100%; max-width: 372px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            box-shadow: var(--shadow-lg);
            padding: 26px 22px;
        }

        /* ---------- 代码预览 ---------- */
        .code-view {
            background: var(--surface-2);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 12px;
            font-family: var(--mono); font-size: 11.5px; line-height: 1.65;
            max-height: 58dvh; overflow: auto;
            white-space: pre; tab-size: 2;
        }

        /* ---------- 状态栏 ---------- */
        .toast {
            position: fixed; left: 50%; transform: translateX(-50%);
            bottom: 78px; z-index: 90;
            max-width: calc(100vw - 32px);
            padding: 9px 15px; border-radius: 999px;
            font-size: 12.5px; font-weight: 550;
            box-shadow: var(--shadow-lg);
            background: var(--text); color: var(--surface);
            display: flex; align-items: center; gap: 7px;
        }
        @media (min-width: 768px) { .toast { bottom: 26px; } }
        .toast.err { background: var(--danger-soft); color: var(--danger); border: 1px solid var(--danger); }
        .toast.ok { background: var(--success-soft); color: var(--success); border: 1px solid var(--success); }

        .spin { animation: sp .8s linear infinite; display: inline-block; }
        @keyframes sp { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
            .spin { animation: none; }
            * { transition: none !important; }
        }
        .hidden { display: none !important; }
        .sr-only {
            position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
            overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
        }
        .btn.is-disabled { opacity: .5; pointer-events: none; }
        .btn:focus-within { outline: 2px solid var(--accent); outline-offset: 1px; }
        .chip-orphan { background: var(--warn-soft); color: var(--warn); }
        __DEBUG_PANEL_STYLE__
    </style>
    <script>
        __DEBUG_PANEL_SCRIPT__
    </script>
</head>
<body x-data="appData()" x-init="init()">
    __DEBUG_PANEL_BODY__

    <!-- ================= 登录 ================= -->
    <div class="login-wrap" x-show="!isAuthenticated">
        <div class="login-card">
            <div style="text-align:center;margin-bottom:20px">
                <svg width="46" height="46" viewBox="0 0 100 100" fill="none" style="margin:0 auto 10px">
                    <path d="M50 10L85 30V70L50 90L15 70V30L50 10Z" fill="#2563EB"/>
                    <path d="M40 35L30 50L40 65" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M60 35L70 50L60 65" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="50" cy="50" r="3" fill="white"/>
                </svg>
                <h2 style="font-size:17px">SubPanel</h2>
                <p class="hint" style="margin-top:4px">Mihomo 配置托管控制台</p>
            </div>
            <div id="runtime-warning" class="alert alert-warn hidden" style="margin-bottom:12px">
                前端脚本未加载，登录与页面交互不可用。请检查 /assets/alpine.min.js 是否返回 200，然后刷新重试。
            </div>
            <p class="hint" style="text-align:center" x-show="checkingSession" x-cloak>正在检查登录状态…</p>
            <form @submit.prevent="login()" style="display:flex;flex-direction:column;gap:11px" x-show="!checkingSession">
                <div class="field">
                    <label class="label" for="login-pass">管理员密码</label>
                    <input id="login-pass" type="password" class="input" x-model="loginInput"
                           autocomplete="current-password" placeholder="请输入管理员密码" :disabled="loginLoading">
                </div>
                <p x-show="loginError" x-text="loginError" class="alert alert-err" role="alert" x-cloak></p>
                <button type="submit" class="btn btn-primary btn-block" :disabled="loginLoading || !loginInput">
                    <span x-show="loginLoading" class="spin">◌</span>
                    <span x-text="loginLoading ? '验证中…' : '登录'"></span>
                </button>
            </form>
        </div>
    </div>

    <!-- ================= 主界面 ================= -->
    <div class="app" x-show="isAuthenticated" x-cloak>
        <aside class="sidebar">
            <div class="brand">
                <svg width="26" height="26" viewBox="0 0 100 100" fill="none">
                    <path d="M50 10L85 30V70L50 90L15 70V30L50 10Z" fill="#2563EB"/>
                    <path d="M40 35L30 50L40 65" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M60 35L70 50L60 65" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="brand-name">SubPanel</span>
                <span class="brand-tag">Mihomo</span>
            </div>
            <template x-for="tab in navTabs" :key="tab.key">
                <button class="nav-item" :class="activeTab === tab.key ? 'active' : ''"
                        @click="switchTab(tab.key)" :aria-current="activeTab === tab.key ? 'page' : null">
                    <span x-html="tab.icon" style="width:16px;height:16px"></span>
                    <span x-text="tab.label"></span>
                    <span class="nav-badge" x-show="tab.count" x-text="tab.count"></span>
                </button>
            </template>
            <div class="sidebar-foot">
                <button class="nav-item" @click="logout()">
                    <span style="width:16px;height:16px"></span>
                    <span>退出登录</span>
                </button>
            </div>
        </aside>

        <div class="main">
            <header class="topbar">
                <div style="min-width:0">
                    <div class="topbar-title" x-text="currentTabLabel"></div>
                    <div class="topbar-sub" x-text="topbarSubtitle"></div>
                </div>
                <div class="spacer"></div>
                <button class="btn btn-ghost btn-sm" @click="cycleTheme()" :title="'主题：' + themeLabel"
                        :aria-label="'切换主题，当前 ' + themeLabel">
                    <span x-text="themeIcon"></span>
                </button>
            </header>

            <main class="content">
                <!-- ========== 输出配置 ========== -->
                <div class="page" x-show="activeTab === 'output'" x-cloak>
                    <div class="alert alert-warn" x-show="mustChangePassword" x-cloak>
                        <span>当前仍是默认密码 admin，存在安全风险，请前往「设置」修改。</span>
                    </div>
                    <div class="alert alert-info" x-show="ruleDirtyCount > 0" x-cloak>
                        <span style="flex:1">规则附加有 <b x-text="ruleDirtyCount"></b> 处未保存的修改，合成时不会包含这些修改。</span>
                        <button class="btn btn-sm" @click="goToRules()">去保存</button>
                    </div>

                    <div class="card">
                        <div class="card-head">
                            <span class="card-title">配置档案</span>
                            <span class="badge" x-text="outputConfigs.length + ' / 5'"></span>
                            <div class="spacer"></div>
                            <button class="btn btn-sm" @click="addOutputConfig()"
                                    :disabled="outputConfigs.length >= 5 || busy.output || busy.generate" x-cloak>新增</button>
                        </div>
                        <div class="card-body flush">
                            <template x-for="cfg in outputConfigs" :key="cfg.id">
                                <div class="item" @click="selectOutputConfig(cfg.id)" style="cursor:pointer">
                                    <div class="item-main">
                                        <div class="item-title">
                                            <span x-text="cfg.name"></span>
                                            <span class="badge" :class="configStatus(cfg).cls"
                                                  x-text="configStatus(cfg).text"></span>
                                            <span class="badge badge-accent" x-show="activeConfigId === cfg.id">当前</span>
                                        </div>
                                        <div class="item-meta">
                                            <span x-text="templateLabelById(cfg.templateId)"></span>
                                            <span x-text="' · ' + cfg.subNames.length + ' 订阅 · ' + cfg.nodeNames.length + ' 单节点'"></span>
                                            <span x-text="cfg.updatedAt ? ' · ' + cfg.updatedAt : ''"></span>
                                        </div>
                                    </div>
                                    <div class="item-actions">
                                        <button class="btn btn-sm" @click.stop="openConfigLink(cfg)"
                                                :disabled="!cfg.hasGenerated">链接</button>
                                        <button class="btn btn-sm" @click.stop="previewConfig(cfg.id)">预览</button>
                                        <button class="btn btn-sm btn-danger" @click.stop="deleteOutputConfig(cfg.id)"
                                                :disabled="outputConfigs.length <= 1 || busy.output || busy.generate" x-cloak>删除</button>
                                    </div>
                                </div>
                            </template>
                            <div class="empty" x-show="outputConfigs.length === 0">暂无配置档案</div>
                        </div>
                    </div>

                    <div class="card" x-show="activeConfig" x-cloak>
                        <div class="card-head">
                            <span class="card-title">编辑当前配置</span>
                            <div class="spacer"></div>
                            <span class="badge" x-text="activeConfig ? activeConfig.name : ''"></span>
                        </div>
                        <div class="card-body" style="display:flex;flex-direction:column;gap:14px">
                            <div class="field">
                                <label class="label">配置名称</label>
                                <input class="input" :value="activeConfig ? activeConfig.name : ''"
                                       @change="renameOutputConfig($event.target.value)" :disabled="outputSelectionLocked" maxlength="40">
                            </div>

                            <div>
                                <div class="section-label">订阅来源</div>
                                <div class="row" x-show="subs.length > 0">
                                    <template x-for="sub in subs" :key="sub.name">
                                        <label class="check">
                                            <input type="checkbox" :value="sub.name"
                                                   :checked="activeConfig && activeConfig.subNames.includes(sub.name)"
                                                   @change="toggleConfigSub(sub.name, $event.target.checked)" :disabled="outputSelectionLocked">
                                            <span x-text="sub.name"></span>
                                        </label>
                                    </template>
                                </div>
                                <div class="empty" x-show="subs.length === 0" style="padding:14px">
                                    还没有订阅，请先到「节点来源」添加。
                                </div>
                            </div>

                            <div>
                                <div class="section-label">单节点</div>
                                <div class="row" x-show="nodes.length > 0">
                                    <template x-for="node in nodes" :key="node.name">
                                        <label class="check">
                                            <input type="checkbox" :value="node.name"
                                                   :checked="activeConfig && activeConfig.nodeNames.includes(node.name)"
                                                   @change="toggleConfigNode(node.name, $event.target.checked)" :disabled="outputSelectionLocked">
                                            <span x-text="node.name"></span>
                                        </label>
                                    </template>
                                </div>
                                <div class="empty" x-show="nodes.length === 0" style="padding:14px">
                                    还没有单节点，可在「节点来源」中手动添加。
                                </div>
                            </div>

                            <div class="field">
                                <label class="label" for="cfg-template">模板</label>
                                <div class="select-wrap" x-show="templates.length > 0">
                                    <select id="cfg-template" class="select"
                                            :value="activeConfig && templateById(activeConfig.templateId) ? activeConfig.templateId : ''"
                                            @change="setConfigTemplate($event.target.value)" :disabled="outputSelectionLocked">
                                        <option value="">请选择模板</option>
                                        <template x-for="tpl in templates" :key="tpl.id">
                                            <option :value="tpl.id" x-text="tpl.name"></option>
                                        </template>
                                    </select>
                                </div>
                                <div class="alert alert-warn" x-show="templates.length === 0">
                                    <span style="flex:1">还没有模板，请先到「模板管理」添加。</span>
                                    <button class="btn btn-sm" @click="switchTab('templates')">去添加</button>
                                </div>
                            </div>

                            <div class="row">
                                <label class="check">
                                    <input type="checkbox" :checked="activeConfig && activeConfig.ruleAppendEnabled"
                                           @change="toggleConfigRuleAppend($event.target.checked)" :disabled="outputSelectionLocked">
                                    <span>启用规则附加</span>
                                </label>
                                <label class="check">
                                    <input type="checkbox" :checked="activeConfig && activeConfig.hostsAppendEnabled"
                                           @change="toggleConfigHostsAppend($event.target.checked)" :disabled="outputSelectionLocked">
                                    <span>启用 Hosts 附加</span>
                                </label>
                            </div>

                            <div class="row">
                                <button class="btn btn-primary" @click="generateConfig()"
                                        :disabled="outputSelectionLocked || !canGenerate">
                                    <span x-show="busy.generate" class="spin">◌</span>
                                    <span x-text="busy.generate ? '合成中…' : '合成更新'"></span>
                                </button>
                                <button class="btn" @click="copyConfigLink()"
                                        :disabled="!activeConfig || !activeConfig.hasGenerated">复制订阅链接</button>
                                <button class="btn" @click="previewConfig(activeConfigId)">预览 YAML</button>
                            </div>

                            <p class="hint" x-show="busy.output" x-cloak>正在保存配置选择…</p>
                            <div class="alert alert-warn" x-show="outputSaveQueue.length > 0 && !busy.output" x-cloak>
                                <span style="flex:1">配置选择尚未保存，当前修改已保留。</span>
                                <button class="btn btn-sm" @click="flushOutputSaves()">重试保存</button>
                            </div>
                            <p class="hint" x-show="!canGenerate" x-text="generateBlockReason" x-cloak></p>
                            <div class="alert alert-warn" x-show="skippedRuleNotice" x-cloak>
                                <div>
                                    <div style="font-weight:600;margin-bottom:3px" x-text="skippedRuleNotice.title"></div>
                                    <div x-text="skippedRuleNotice.detail"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ========== 节点来源 ========== -->
                <div class="page" x-show="activeTab === 'sources'" x-cloak>
                    <div class="segmented" role="tablist">
                        <button :class="sourceTab === 'sub' ? 'active' : ''" @click="sourceTab = 'sub'" role="tab">
                            <span x-text="'机场订阅 ' + subs.length + '/5'"></span>
                        </button>
                        <button :class="sourceTab === 'node' ? 'active' : ''" @click="sourceTab = 'node'" role="tab">
                            <span x-text="'自建单节点 ' + nodes.length + '/5'"></span>
                        </button>
                    </div>

                    <!-- 订阅列表 -->
                    <div class="card" x-show="sourceTab === 'sub'">
                        <div class="card-head">
                            <span class="card-title">机场订阅</span>
                            <button type="button" class="info-btn" @click="showSubModeHelp = !showSubModeHelp"
                                    :aria-expanded="showSubModeHelp" aria-controls="sub-mode-help"
                                    title="两种使用方式的区别">i</button>
                            <div class="spacer"></div>
                            <button class="btn btn-primary btn-sm" @click="openSubDialog()"
                                    :disabled="subs.length >= 5 || busy.sub">新增订阅</button>
                        </div>
                        <div class="help-panel" id="sub-mode-help" x-show="showSubModeHelp" x-cloak>
                            <div><b>Provider 托管</b>：配置中只写入订阅链接（proxy-providers），由 Mihomo 客户端自行拉取和更新节点。</div>
                            <div><b>节点列表</b>：由面板解析订阅，把节点直接写入配置的 proxies；可刷新、上传文件或粘贴内容来更新。</div>
                        </div>
                        <div class="card-body flush">
                            <template x-for="(sub, index) in subs" :key="sub.name">
                                <div class="item sub-item">
                                    <div class="item-main">
                                        <div class="item-title" x-text="sub.name"></div>
                                        <div class="item-meta mono" x-text="sub.url"></div>
                                        <div class="item-meta" x-text="subStatusText(sub)"></div>
                                    </div>
                                    <div class="item-side">
                                        <div class="segmented segmented-sm" role="radiogroup"
                                             :aria-label="sub.name + ' 的使用方式'">
                                            <button type="button" role="radio" :aria-checked="sub.useProvider ? 'true' : 'false'"
                                                    :class="sub.useProvider ? 'active' : ''"
                                                    @click="setSubMode(index, true)" :disabled="busy.sub">Provider 托管</button>
                                            <button type="button" role="radio" :aria-checked="sub.useProvider ? 'false' : 'true'"
                                                    :class="sub.useProvider ? '' : 'active'"
                                                    @click="setSubMode(index, false)" :disabled="busy.sub">节点列表</button>
                                        </div>
                                        <div class="item-actions">
                                            <button class="btn btn-sm" x-show="!sub.useProvider"
                                                    @click="updateSubFromUrl(index)" :disabled="busy.sub">
                                                <span x-show="busy.subIndex === index && busy.subType === 'url'" class="spin">◌</span>
                                                刷新
                                            </button>
                                            <label class="btn btn-sm" x-show="!sub.useProvider"
                                                   :class="busy.sub ? 'is-disabled' : ''">
                                                上传
                                                <input type="file" class="sr-only"
                                                       accept=".yaml,.yml,.txt,text/yaml,application/yaml,text/plain"
                                                       @change="uploadSubFile(index, $event)" :disabled="busy.sub">
                                            </label>
                                            <button class="btn btn-sm" x-show="!sub.useProvider"
                                                    @click="openPasteDialog(index)" :disabled="busy.sub">粘贴</button>
                                            <button class="btn btn-sm" @click="openSubDialog(index)" :disabled="busy.sub">编辑</button>
                                            <button class="btn btn-sm btn-danger" @click="deleteSub(index)" :disabled="busy.sub">删除</button>
                                        </div>
                                    </div>
                                </div>
                            </template>
                            <div class="empty" x-show="subs.length === 0">
                                还没有订阅。点击「新增订阅」填入机场提供的订阅链接。
                            </div>
                        </div>
                    </div>

                    <!-- 单节点列表 -->
                    <div class="card" x-show="sourceTab === 'node'" x-cloak>
                        <div class="card-head">
                            <span class="card-title">自建单节点</span>
                            <div class="spacer"></div>
                            <button class="btn btn-primary btn-sm" @click="openNodeDialog()"
                                    :disabled="nodes.length >= 5 || busy.node">新增节点</button>
                        </div>
                        <div class="card-body flush">
                            <template x-for="(node, index) in nodes" :key="node.name">
                                <div class="item">
                                    <div class="item-main">
                                        <div class="item-title" x-text="node.name"></div>
                                        <div class="item-meta mono" x-text="truncate(node.content, 90)"></div>
                                    </div>
                                    <div class="item-actions">
                                        <button class="btn btn-sm" @click="openNodeDialog(index)" :disabled="busy.node">编辑</button>
                                        <button class="btn btn-sm btn-danger" @click="deleteNode(index)" :disabled="busy.node">删除</button>
                                    </div>
                                </div>
                            </template>
                            <div class="empty" x-show="nodes.length === 0">
                                还没有单节点。支持 ss / vmess / vless / trojan / hysteria2 / anytls 链接或 YAML 片段。
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ========== 模板 ========== -->
                <div class="page" x-show="activeTab === 'templates'" x-cloak>
                    <div class="alert alert-warn" x-show="templatesOverLimit" x-cloak>
                        <span x-text="'模板数量超过上限（' + templates.length + ' / ' + maxTemplates + '），请删除多余的模板后再新增。'"></span>
                    </div>
                    <div class="card">
                        <div class="card-head">
                            <span class="card-title">模板</span>
                            <span class="badge" :class="templatesOverLimit ? 'badge-warn' : ''"
                                  x-text="templates.length + ' / ' + maxTemplates"></span>
                            <div class="spacer"></div>
                            <button class="btn btn-primary btn-sm" @click="openTemplateDialog()"
                                    :disabled="templates.length >= maxTemplates || busy.template">新增模板</button>
                        </div>
                        <div class="card-body flush">
                            <template x-for="(tpl, index) in templates" :key="tpl.id">
                                <div class="item">
                                    <div class="item-main">
                                        <div class="item-title">
                                            <span class="tpl-tag" :class="'tpl-c' + templateColor(tpl.id)" x-text="tpl.name"></span>
                                            <span class="badge" x-text="tpl.type === 'url' ? '链接' : '文本'"></span>
                                            <span class="badge" x-text="tpl.groupCount + ' 策略组'"></span>
                                        </div>
                                        <div class="item-meta">
                                            <span class="mono" x-show="tpl.url" x-text="tpl.url + ' · '"></span>
                                            <span x-text="tpl.updatedAt ? '更新于 ' + tpl.updatedAt : ''"></span>
                                        </div>
                                    </div>
                                    <div class="item-actions">
                                        <button class="btn btn-sm" @click="viewTemplateGroups(tpl)" :disabled="busy.template">策略组</button>
                                        <button class="btn btn-sm" x-show="tpl.type === 'url'"
                                                @click="refreshTemplate(index)" :disabled="busy.template">刷新</button>
                                        <button class="btn btn-sm" @click="openTemplateDialog(index)" :disabled="busy.template">编辑</button>
                                        <button class="btn btn-sm btn-danger" @click="deleteTemplate(index)" :disabled="busy.template">删除</button>
                                    </div>
                                </div>
                            </template>
                            <div class="empty" x-show="templates.length === 0">
                                还没有模板。点击「新增模板」粘贴模板文本或填入模板 URL；生成配置前必须至少有一个模板。
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ========== 规则与 Hosts ========== -->
                <div class="page" x-show="activeTab === 'rules'" x-cloak>
                    <div class="segmented">
                        <button :class="ruleTab === 'rules' ? 'active' : ''" @click="ruleTab = 'rules'">规则附加</button>
                        <button :class="ruleTab === 'hosts' ? 'active' : ''" @click="ruleTab = 'hosts'">Hosts 附加</button>
                    </div>

                    <!-- 规则附加 -->
                    <div x-show="ruleTab === 'rules'" x-cloak style="display:flex;flex-direction:column;gap:14px">
                        <div class="card card-overflow">
                            <div class="card-head">
                                <span class="card-title" x-text="editingRuleId ? '编辑规则（第 ' + editingRuleNumber + ' 条）' : '添加规则'"></span>
                                <div class="spacer"></div>
                                <span class="hint">修改先暂存在列表中，点「保存全部」后统一写入</span>
                            </div>
                            <div class="card-body" style="display:flex;flex-direction:column;gap:12px">
                                <div class="grid-2">
                                    <div class="field">
                                        <label class="label" for="rule-target">应用到</label>
                                        <div class="select-wrap">
                                            <select id="rule-target" class="select" x-model="ruleForm.target">
                                                <option value="global">全局（所有模板）</option>
                                                <template x-for="tpl in templates" :key="tpl.id">
                                                    <option :value="tpl.id" x-text="tpl.name"></option>
                                                </template>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="field">
                                        <label class="label" for="rule-type">规则类型</label>
                                        <div class="select-wrap">
                                            <select id="rule-type" class="select" x-model="ruleForm.type">
                                                <template x-for="type in ruleTypes" :key="type">
                                                    <option :value="type" x-text="type"></option>
                                                </template>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div class="field">
                                    <label class="label" for="rule-info">匹配内容</label>
                                    <input id="rule-info" class="input mono" x-model="ruleForm.info"
                                           :placeholder="ruleInfoPlaceholder"
                                           @keydown.enter.prevent="stageRule()">
                                </div>

                                <div class="grid-2">
                                    <div class="field">
                                        <span class="label" id="rule-policy-label">策略组</span>
                                        <div class="picker" @click.outside="policyPicker.open = false">
                                            <button type="button" id="rule-policy" class="picker-trigger"
                                                    :class="{ 'is-invalid': !!ruleFormPolicyError, 'is-open': policyPicker.open }"
                                                    aria-haspopup="listbox" :aria-expanded="policyPicker.open ? 'true' : 'false'"
                                                    aria-labelledby="rule-policy-label"
                                                    @click="togglePolicyPicker()"
                                                    @keydown.down.prevent="openPolicyPicker()">
                                                <span class="picker-value" x-text="policyDisplay(ruleForm.policy)"></span>
                                                <span class="owner-tags">
                                                    <template x-for="owner in policyTriggerOwners()" :key="owner.id">
                                                        <span class="tpl-tag" :class="'tpl-c' + owner.color" x-text="owner.name"></span>
                                                    </template>
                                                </span>
                                                <span class="picker-caret" aria-hidden="true"></span>
                                            </button>
                                            <div class="picker-panel" x-show="policyPicker.open" x-cloak
                                                 @keydown.escape.stop.prevent="closePolicyPicker(true)">
                                                <input id="policy-search" class="input picker-search" type="search"
                                                       x-model="policyPicker.query" placeholder="搜索策略组" autocomplete="off"
                                                       aria-label="搜索策略组" aria-controls="policy-listbox"
                                                       @input="policyPicker.cursor = 0"
                                                       @keydown.down.prevent="movePolicyCursor(1)"
                                                       @keydown.up.prevent="movePolicyCursor(-1)"
                                                       @keydown.enter.prevent="pickPolicyAtCursor()"
                                                       @keydown.tab="policyPicker.open = false">
                                                <div class="picker-list" id="policy-listbox" role="listbox" aria-labelledby="rule-policy-label">
                                                    <template x-for="(opt, i) in policyPickerOptions" :key="opt.section + ':' + opt.value">
                                                        <div>
                                                            <div class="picker-section" x-show="opt.sectionStart"
                                                                 x-text="opt.section === 'builtin' ? '内置策略' : (ruleForm.target === 'global' ? '策略组（标签为所属模板）' : '策略组')"></div>
                                                            <button type="button" class="picker-option" role="option" tabindex="-1"
                                                                    :data-policy-index="i"
                                                                    :aria-selected="ruleForm.policy === opt.value ? 'true' : 'false'"
                                                                    :class="{ 'is-active': policyPicker.cursor === i, 'is-selected': ruleForm.policy === opt.value }"
                                                                    @mousemove="policyPicker.cursor = i"
                                                                    @click="pickPolicy(opt.value)">
                                                                <span class="picker-option-name" x-text="opt.label"></span>
                                                                <span class="owner-tags" x-show="opt.owners.length > 0">
                                                                    <template x-for="owner in opt.owners" :key="owner.id">
                                                                        <span class="tpl-tag" :class="'tpl-c' + owner.color" x-text="owner.name"></span>
                                                                    </template>
                                                                </span>
                                                            </button>
                                                        </div>
                                                    </template>
                                                    <div class="picker-empty" x-show="policyPickerOptions.length === 0">没有匹配的策略组</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="field">
                                        <span class="label">附加选项</span>
                                        <label class="check" style="height:37px">
                                            <input type="checkbox" x-model="ruleForm.noResolve"
                                                   :disabled="!ruleSupportsNoResolve">
                                            <span :style="ruleSupportsNoResolve ? '' : 'color:var(--text-3)'">no-resolve</span>
                                        </label>
                                    </div>
                                </div>

                                <p class="alert alert-err" x-show="ruleFormError || ruleFormPolicyError"
                                   x-text="ruleFormError || ruleFormPolicyError" role="alert" x-cloak></p>

                                <div class="row">
                                    <button class="btn btn-primary" @click="stageRule()" :disabled="!!ruleFormPolicyError">
                                        <span x-text="editingRuleId ? '更新到列表' : '添加到列表'"></span>
                                    </button>
                                    <button class="btn" x-show="editingRuleId" @click="cancelEditRule()">取消编辑</button>
                                    <button class="btn" @click="openImportDialog()">批量导入</button>
                                    <div class="spacer"></div>
                                    <button class="btn btn-ghost btn-sm" @click="clearAllRules()"
                                            :disabled="activeRuleCount === 0">全部标记删除</button>
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-head">
                                <span class="card-title">规则列表</span>
                                <span class="badge" x-text="activeRuleCount + ' 条'"></span>
                                <div class="spacer"></div>
                                <span class="hint">拖动 ⠿ 到目标位置松开，越靠前越优先；拖动中按 Esc 取消</span>
                            </div>
                            <div class="rule-list" id="rule-list">
                                <div id="rule-drag-indicator" aria-hidden="true"><span class="rule-drop-label"></span></div>
                                <template x-for="rule in ruleDraft" :key="rule.id">
                                    <div class="rule-row" :data-rule-id="rule.id" :class="ruleRowClass(rule)">
                                        <button type="button" class="drag-handle" :disabled="!!rule._deleted"
                                                title="拖动排序（聚焦后可用 ↑ ↓ 键调整）"
                                                :aria-label="'第 ' + ruleOrderNumber(rule) + ' 条，拖动或按上下方向键调整顺序'"
                                                @pointerdown="startRuleDrag($event, rule.id)"
                                                @keydown.up.prevent="nudgeRule(rule.id, -1)"
                                                @keydown.down.prevent="nudgeRule(rule.id, 1)">⠿</button>
                                        <span class="rule-index" x-text="ruleOrderNumber(rule)"></span>
                                        <div class="rule-body">
                                            <div class="rule-code" x-text="ruleLineText(rule)"></div>
                                            <div class="rule-tags">
                                                <span class="tpl-tag" :class="targetTagClass(rule.target)" x-text="targetLabel(rule.target)"></span>
                                                <span class="chip chip-new" x-show="rule._new && !rule._deleted">新增</span>
                                                <span class="chip chip-mod" x-show="isRuleModified(rule)">已修改</span>
                                                <span class="chip chip-del" x-show="rule._deleted">待删除</span>
                                                <span class="chip" x-show="rule.policy === 'NULL'">已停用</span>
                                            </div>
                                            <div class="rule-msg err" x-show="ruleBlockingError(rule)" x-text="ruleBlockingError(rule)"></div>
                                            <div class="rule-msg warn" x-show="ruleWarning(rule)" x-text="ruleWarning(rule)"></div>
                                        </div>
                                        <div class="rule-actions">
                                            <button class="btn" x-show="!rule._deleted" @click="toggleRuleNull(rule)"
                                                    x-text="rule.policy === 'NULL' ? '启用' : '停用'"></button>
                                            <button class="btn" x-show="!rule._deleted" @click="editRule(rule)">编辑</button>
                                            <button class="btn btn-danger" x-show="!rule._deleted" @click="removeRule(rule)">删除</button>
                                            <button class="btn" x-show="rule._deleted" @click="restoreRule(rule)">撤销删除</button>
                                        </div>
                                    </div>
                                </template>
                                <div class="empty" x-show="ruleDraft.length === 0">
                                    还没有规则。上方填写后点击「添加到列表」，再点「保存全部」。
                                </div>
                            </div>
                        </div>

                        <div class="unsaved-bar" x-show="ruleDirtyCount > 0" x-cloak role="status">
                            <span class="dot" aria-hidden="true">●</span>
                            <span x-text="'有 ' + ruleDirtyCount + ' 处未保存的修改'"></span>
                            <span class="bar-note" x-show="ruleInvalidCount > 0" x-text="'（' + ruleInvalidCount + ' 条需修正）'"></span>
                            <div class="spacer"></div>
                            <button class="btn btn-sm" @click="discardRuleDraft()" :disabled="busy.rule">放弃修改</button>
                            <button class="btn btn-sm btn-primary" @click="saveRuleDraft()" :disabled="busy.rule || ruleInvalidCount > 0">
                                <span x-show="busy.rule" class="spin">◌</span>
                                保存全部
                            </button>
                        </div>
                    </div>

                    <!-- Hosts 附加 -->
                    <div x-show="ruleTab === 'hosts'" x-cloak style="display:flex;flex-direction:column;gap:14px">
                        <div class="card">
                            <div class="card-head">
                                <span class="card-title">Hosts 订阅源</span>
                                <span class="badge" x-text="hostsConfig.subs.length + ' / 5'"></span>
                                <div class="spacer"></div>
                                <button class="btn btn-primary btn-sm" @click="openHostsDialog()"
                                        :disabled="hostsConfig.subs.length >= 5 || busy.hosts">新增订阅源</button>
                            </div>
                            <div class="card-body flush">
                                <template x-for="(sub, index) in hostsConfig.subs" :key="sub.name">
                                    <div class="item">
                                        <div class="item-main">
                                            <div class="item-title">
                                                <span x-text="sub.name"></span>
                                                <span class="badge" :class="sub.entryCount > hostsMaxEntries ? 'badge-warn' : ''"
                                                      x-text="sub.entryCount + ' 域名'"></span>
                                                <span class="badge" :class="sub.autoUpdate ? 'badge-accent' : ''"
                                                      x-text="sub.autoUpdate ? '自动更新' : '手动'"></span>
                                            </div>
                                            <div class="item-meta">
                                                <span class="mono" x-text="sub.url"></span>
                                                <span x-text="sub.updatedAt ? ' · ' + sub.updatedAt : ' · 未更新'"></span>
                                            </div>
                                            <div class="item-meta" x-show="sub.lastError" style="color:var(--danger)"
                                                 x-text="'上次错误：' + sub.lastError"></div>
                                        </div>
                                        <div class="item-actions">
                                            <button class="btn btn-sm" @click="openHostsDetail(index)" :disabled="busy.hosts">查看</button>
                                            <button class="btn btn-sm" @click="toggleHostsAuto(index)" :disabled="busy.hosts"
                                                    x-text="sub.autoUpdate ? '关闭自动' : '开启自动'"></button>
                                            <button class="btn btn-sm" @click="refreshHostsSub(index)" :disabled="busy.hosts">
                                                <span x-show="busy.hostsIndex === index" class="spin">◌</span>
                                                刷新
                                            </button>
                                            <button class="btn btn-sm" @click="openHostsDialog(index)" :disabled="busy.hosts">编辑</button>
                                            <button class="btn btn-sm btn-danger" @click="deleteHostsSub(index)" :disabled="busy.hosts">删除</button>
                                        </div>
                                    </div>
                                </template>
                                <div class="empty" x-show="hostsConfig.subs.length === 0">
                                    还没有 Hosts 订阅源。可添加 hosts 文件格式的 URL（每个订阅源最多 300 个域名）。
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-head">
                                <span class="card-title">筛选与静态 Hosts</span>
                                <div class="spacer"></div>
                                <span class="badge" x-text="hostsConfig.mergedCount + ' 条将写入'"></span>
                            </div>
                            <div class="card-body" style="display:flex;flex-direction:column;gap:13px">
                                <div class="field">
                                    <label class="label">IP 协议筛选</label>
                                    <div class="segmented">
                                        <button :class="hostsConfig.ipFilter === 'all' ? 'active' : ''"
                                                @click="setHostsIpFilter('all')">全部</button>
                                        <button :class="hostsConfig.ipFilter === 'ipv4' ? 'active' : ''"
                                                @click="setHostsIpFilter('ipv4')">仅 IPv4</button>
                                        <button :class="hostsConfig.ipFilter === 'ipv6' ? 'active' : ''"
                                                @click="setHostsIpFilter('ipv6')">仅 IPv6</button>
                                    </div>
                                </div>

                                <div class="field">
                                    <div class="field-head">
                                        <label class="label" for="hosts-static">静态 Hosts</label>
                                        <span class="counter" :class="staticHostsCount > hostsMaxEntries ? 'over' : ''"
                                              x-text="'已填 ' + staticHostsCount + ' / ' + hostsMaxEntries + ' 条'"></span>
                                    </div>
                                    <textarea id="hosts-static" class="textarea" rows="7" x-model="hostsStaticDraft"
                                              placeholder="example.com: [1.2.3.4, 5.6.7.8]&#10;另一个域名: 9.9.9.9"
                                              spellcheck="false"></textarea>
                                    <span class="hint">每行一条，格式：域名: [IP1, IP2]，与订阅源同域名时以静态内容为准；保存时会检查格式。</span>
                                </div>

                                <p class="alert alert-err" x-show="hostsValidationError" x-text="hostsValidationError" x-cloak></p>

                                <div class="row">
                                    <button class="btn btn-primary" @click="saveStaticHosts()"
                                            :disabled="busy.hosts || staticHostsCount > hostsMaxEntries">
                                        <span x-show="busy.hosts" class="spin">◌</span>
                                        保存静态 Hosts
                                    </button>
                                    <button class="btn" @click="hostsStaticDraft = ''">清空输入</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ========== 设置 ========== -->
                <div class="page" x-show="activeTab === 'settings'" x-cloak>
                    <div class="card">
                        <div class="card-head"><span class="card-title">修改管理员密码</span></div>
                        <div class="card-body" style="display:flex;flex-direction:column;gap:12px">
                            <div class="field">
                                <label class="label" for="new-pass">新密码</label>
                                <input id="new-pass" type="password" class="input" x-model="passwordForm.next"
                                       autocomplete="new-password" placeholder="至少 6 位">
                            </div>
                            <div class="field">
                                <label class="label" for="new-pass2">确认新密码</label>
                                <input id="new-pass2" type="password" class="input" x-model="passwordForm.confirm"
                                       autocomplete="new-password" placeholder="再次输入">
                            </div>
                            <p class="alert alert-err" x-show="passwordForm.error" x-text="passwordForm.error" x-cloak></p>
                            <p class="alert alert-ok" x-show="passwordForm.ok" x-text="passwordForm.ok" x-cloak></p>
                            <div>
                                <button class="btn btn-primary" @click="changePassword()" :disabled="busy.password">
                                    <span x-show="busy.password" class="spin">◌</span>
                                    保存新密码
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-head"><span class="card-title">外观</span></div>
                        <div class="card-body">
                            <div class="field">
                                <label class="label">主题</label>
                                <div class="segmented">
                                    <button :class="theme === 'auto' ? 'active' : ''" @click="setTheme('auto')">跟随系统</button>
                                    <button :class="theme === 'light' ? 'active' : ''" @click="setTheme('light')">浅色</button>
                                    <button :class="theme === 'dark' ? 'active' : ''" @click="setTheme('dark')">深色</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-head"><span class="card-title">数据备份</span></div>
                        <div class="card-body" style="display:flex;flex-direction:column;gap:12px">
                            <p class="hint">
                                导出内容包含订阅链接、模板、规则、Hosts 与全部配置 Token，请妥善保管。
                            </p>
                            <div class="row">
                                <button class="btn" @click="exportBackup()" :disabled="busy.backup">导出备份</button>
                                <label class="btn" :class="busy.backup ? 'is-disabled' : ''">
                                    导入备份
                                    <input type="file" class="sr-only" accept=".json,application/json"
                                           @change="importBackup($event)" :disabled="busy.backup">
                                </label>
                            </div>
                            <p class="alert alert-ok" x-show="backupMsg" x-text="backupMsg" x-cloak></p>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-head"><span class="card-title">会话</span></div>
                        <div class="card-body">
                            <button class="btn btn-danger" @click="logout()">退出登录</button>
                        </div>
                    </div>
                </div>
            </main>

            <nav class="bottom-nav">
                <template x-for="tab in navTabs" :key="tab.key">
                    <button class="bottom-item" :class="activeTab === tab.key ? 'active' : ''"
                            @click="switchTab(tab.key)" :aria-current="activeTab === tab.key ? 'page' : null">
                        <span x-html="tab.icon"></span>
                        <span x-text="tab.shortLabel"></span>
                    </button>
                </template>
            </nav>
        </div>
    </div>

    <!-- ================= 通用弹窗容器 ================= -->
    <div class="overlay" x-show="dialog.open" x-cloak @keydown.escape.window="closeDialog()"
         @click.self="closeDialog()" role="dialog" aria-modal="true">
        <div class="dialog">
            <div class="dialog-head">
                <span class="card-title" x-text="dialog.title"></span>
                <div class="spacer"></div>
                <button class="btn btn-ghost btn-sm" @click="closeDialog()" aria-label="关闭">✕</button>
            </div>
            <div class="dialog-body">
                <!-- 订阅表单 -->
                <template x-if="dialog.kind === 'sub'">
                    <div style="display:flex;flex-direction:column;gap:12px">
                        <div class="field">
                            <label class="label" for="sub-name">名称</label>
                            <input id="sub-name" class="input" x-model="subForm.name" maxlength="40"
                                   placeholder="例如：机场 A">
                        </div>
                        <div class="field">
                            <label class="label" for="sub-url">订阅链接</label>
                            <input id="sub-url" class="input mono" x-model="subForm.url"
                                   placeholder="https://...">
                        </div>
                        <div class="field">
                            <span class="label" id="sub-mode-label">使用方式</span>
                            <div class="segmented" role="radiogroup" aria-labelledby="sub-mode-label">
                                <button type="button" role="radio" :aria-checked="subForm.useProvider ? 'true' : 'false'"
                                        :class="subForm.useProvider ? 'active' : ''" @click="subForm.useProvider = true">Provider 托管</button>
                                <button type="button" role="radio" :aria-checked="subForm.useProvider ? 'false' : 'true'"
                                        :class="subForm.useProvider ? '' : 'active'" @click="subForm.useProvider = false">节点列表</button>
                            </div>
                            <span class="hint" x-text="subForm.useProvider
                                ? '配置中只写入订阅链接，由 Mihomo 客户端自行拉取和更新节点。'
                                : '由面板解析订阅，把节点直接写入配置；保存后请刷新、上传或粘贴来获取节点。'"></span>
                        </div>
                        <label class="check" x-show="subForm.useProvider">
                            <input type="checkbox" x-model="subForm.autoUpdate">
                            <span>客户端每小时自动更新（interval 3600 秒）</span>
                        </label>
                        <p class="alert alert-err" x-show="dialog.error" x-text="dialog.error" x-cloak></p>
                    </div>
                </template>

                <!-- 单节点表单 -->
                <template x-if="dialog.kind === 'node'">
                    <div style="display:flex;flex-direction:column;gap:12px">
                        <div class="field">
                            <label class="label" for="node-name">节点名称</label>
                            <input id="node-name" class="input" x-model="nodeForm.name" maxlength="40"
                                   placeholder="例如：我的 VPS">
                        </div>
                        <div class="field">
                            <label class="label" for="node-content">节点内容</label>
                            <textarea id="node-content" class="textarea" rows="8" x-model="nodeForm.content"
                                      spellcheck="false"
                                      placeholder="ss://... 或 vless://... 或 YAML 片段"></textarea>
                            <span class="hint">支持分享链接与 YAML 片段，保存时会统一转换为 Mihomo 节点配置。</span>
                        </div>
                        <p class="alert alert-err" x-show="dialog.error" x-text="dialog.error" x-cloak></p>
                    </div>
                </template>

                <!-- 模板表单 -->
                <template x-if="dialog.kind === 'template'">
                    <div style="display:flex;flex-direction:column;gap:12px">
                        <div class="field">
                            <label class="label" for="tpl-name">模板名称</label>
                            <input id="tpl-name" class="input" x-model="templateForm.name" maxlength="40">
                        </div>
                        <div class="field">
                            <label class="label" for="tpl-content">模板内容或 URL</label>
                            <textarea id="tpl-content" class="textarea" rows="11" x-model="templateForm.content"
                                      spellcheck="false"
                                      placeholder="粘贴完整 YAML 模板，或填入 https:// 开头的模板链接"></textarea>
                            <span class="hint">模板必须包含 proxy-groups 与 rules 两个顶层键。</span>
                        </div>
                        <p class="alert alert-err" x-show="dialog.error" x-text="dialog.error" x-cloak></p>
                    </div>
                </template>

                <!-- Hosts 订阅表单 -->
                <template x-if="dialog.kind === 'hosts'">
                    <div style="display:flex;flex-direction:column;gap:12px">
                        <div class="field">
                            <label class="label" for="hosts-name">名称</label>
                            <input id="hosts-name" class="input" x-model="hostsForm.name" maxlength="40">
                        </div>
                        <div class="field">
                            <label class="label" for="hosts-url">订阅链接</label>
                            <input id="hosts-url" class="input mono" x-model="hostsForm.url"
                                   placeholder="https://...">
                            <span class="hint" x-show="dialog.editIndex >= 0">留空则沿用原有链接。</span>
                        </div>
                        <label class="check">
                            <input type="checkbox" x-model="hostsForm.autoUpdate">
                            <span>每 24 小时自动更新</span>
                        </label>
                        <p class="alert alert-err" x-show="dialog.error" x-text="dialog.error" x-cloak></p>
                    </div>
                </template>

                <!-- 粘贴订阅内容 -->
                <template x-if="dialog.kind === 'paste'">
                    <div style="display:flex;flex-direction:column;gap:12px">
                        <p class="hint" x-text="'目标订阅：' + dialog.subName"></p>
                        <div class="field">
                            <label class="label" for="paste-content">订阅原始内容</label>
                            <textarea id="paste-content" class="textarea" rows="12" x-model="pasteForm.content"
                                      spellcheck="false"
                                      placeholder="粘贴订阅链接返回的原始内容，支持 Mihomo YAML、Base64 文本和 URI 列表"></textarea>
                            <span class="hint">上限 2 MiB。解析成功后会覆盖当前缓存，失败不会改动原有节点。</span>
                        </div>
                        <p class="alert alert-err" x-show="dialog.error" x-text="dialog.error" x-cloak></p>
                    </div>
                </template>

                <!-- 批量导入规则 -->
                <template x-if="dialog.kind === 'import'">
                    <div style="display:flex;flex-direction:column;gap:12px">
                        <div class="field">
                            <label class="label" for="import-target">导入到</label>
                            <div class="select-wrap">
                                <select id="import-target" class="select" x-model="importForm.target">
                                    <option value="global">全局（所有模板）</option>
                                    <template x-for="tpl in templates" :key="tpl.id">
                                        <option :value="tpl.id" x-text="tpl.name"></option>
                                    </template>
                                </select>
                            </div>
                        </div>
                        <div class="field">
                            <label class="label" for="import-content">规则文本</label>
                            <textarea id="import-content" class="textarea" rows="10" x-model="importForm.content"
                                      spellcheck="false"
                                      placeholder="DOMAIN-SUFFIX,example.com,PROXY&#10;IP-CIDR,10.0.0.0/8,DIRECT,no-resolve"></textarea>
                            <span class="hint">每行一条，导入后追加到列表末尾（仍需「保存全部」）；格式错误或策略组不存在的行会被跳过并提示行号。</span>
                        </div>
                        <p class="alert alert-err" x-show="dialog.error" x-text="dialog.error" x-cloak></p>
                    </div>
                </template>

                <!-- Hosts 订阅内容（只读） -->
                <template x-if="dialog.kind === 'hostsDetail'">
                    <div style="display:flex;flex-direction:column;gap:10px">
                        <p class="hint" x-text="'共 ' + hostsDetail.entries.length + ' 个域名，按当前筛选（' + hostsFilterLabel + '）将写入 ' + hostsDetail.effectiveCount + ' 个' + (hostsDetail.updatedAt ? ' · 更新于 ' + hostsDetail.updatedAt : '')"></p>
                        <input class="input" type="search" x-model="hostsDetail.query" placeholder="搜索域名或 IP" aria-label="搜索域名或 IP">
                        <div class="code-view" x-text="hostsDetailText"></div>
                    </div>
                </template>

                <!-- 预览 -->
                <template x-if="dialog.kind === 'preview'">
                    <div>
                        <div class="row" style="margin-bottom:10px">
                            <button class="btn btn-sm" @click="copyText(previewContent)">复制内容</button>
                            <span class="hint" x-text="previewContent.split('\\n').length + ' 行'"></span>
                        </div>
                        <div class="code-view" x-text="previewContent"></div>
                    </div>
                </template>

                <!-- 订阅链接 -->
                <template x-if="dialog.kind === 'link'">
                    <div style="display:flex;flex-direction:column;gap:12px">
                        <div class="field">
                            <label class="label">订阅链接</label>
                            <input class="input mono" readonly :value="dialog.link">
                        </div>
                        <div class="row">
                            <button class="btn btn-primary" @click="copyText(dialog.link)">复制链接</button>
                            <button class="btn btn-danger" @click="resetConfigToken()" :disabled="busy.output">重置 Token</button>
                        </div>
                        <p class="hint">重置后旧链接立即失效，需要在客户端更新订阅地址。</p>
                        <p class="alert alert-ok" x-show="dialog.copied" x-text="dialog.copied" x-cloak></p>
                    </div>
                </template>

                <!-- 策略组列表 -->
                <template x-if="dialog.kind === 'groups'">
                    <div>
                        <p class="hint" style="margin-bottom:10px" x-text="dialog.subtitle"></p>
                        <div class="row" style="gap:5px">
                            <template x-for="group in dialog.groups" :key="group">
                                <span class="chip" x-text="group"></span>
                            </template>
                            <span class="hint" x-show="dialog.groups.length === 0">未提取到策略组</span>
                        </div>
                    </div>
                </template>
            </div>
            <div class="dialog-foot" x-show="dialog.confirmLabel">
                <button class="btn" @click="closeDialog()" :disabled="dialog.loading">取消</button>
                <button class="btn btn-primary" @click="submitDialog()" :disabled="dialog.loading">
                    <span x-show="dialog.loading" class="spin">◌</span>
                    <span x-text="dialog.confirmLabel"></span>
                </button>
            </div>
        </div>
    </div>

    <div id="rule-drag-layer" aria-hidden="true"></div>

    <!-- ================= 全局提示 ================= -->
    <div class="toast" x-show="toast.show" x-cloak
         :class="toast.type === 'error' ? 'err' : (toast.type === 'ok' ? 'ok' : '')" role="status">
        <span x-text="toast.message"></span>
    </div>

    <script>
        // Alpine 迟迟未启动时提示资源加载失败（不依赖 DEBUG）
        setTimeout(function () {
            if (window.Alpine) return;
            var el = document.getElementById('runtime-warning');
            if (el) el.classList.remove('hidden');
        }, 4000);
    </script>
    <script>
__CLIENT_SCRIPT__
    </script>
</body>
</html>`;

// ====== [GENERATED: src/client/app.js] ======
const CLIENT_SCRIPT = "// ============================================================================\n// SubPanel 前端（Alpine.js 组件）\n// 本文件是普通浏览器脚本，构建时以字符串形式注入页面，不经过模板字符串。\n// ============================================================================\n\nvar SP_ICONS = {\n    output: '<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 4h16v6H4zM4 14h16v6H4z\"/><path d=\"M8 7h.01M8 17h.01\"/></svg>',\n    sources: '<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"5\" r=\"2.5\"/><circle cx=\"5\" cy=\"19\" r=\"2.5\"/><circle cx=\"19\" cy=\"19\" r=\"2.5\"/><path d=\"M12 7.5v4M12 11.5l-5.5 5M12 11.5l5.5 5\"/></svg>',\n    templates: '<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 3h9l4 4v14H6z\"/><path d=\"M14 3v5h5M9 13h7M9 17h5\"/></svg>',\n    rules: '<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 6h16M4 12h10M4 18h7\"/><path d=\"M17 15l3 3-3 3\"/></svg>',\n    settings: '<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z\"/></svg>'\n};\n\nvar SP_RULE_TYPES = [\n    'DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'DOMAIN-REGEX', 'GEOSITE',\n    'IP-CIDR', 'IP-CIDR6', 'IP-SUFFIX', 'GEOIP', 'SRC-GEOIP',\n    'DST-PORT', 'SRC-PORT', 'PROCESS-NAME', 'PROCESS-PATH', 'RULE-SET'\n];\nvar SP_BUILTIN_POLICIES = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE', 'NULL'];\nvar SP_NO_RESOLVE_TYPES = ['IP-CIDR', 'IP-CIDR6', 'IP-SUFFIX', 'GEOIP', 'SRC-GEOIP'];\nvar SP_RULE_PLACEHOLDERS = {\n    'DOMAIN': 'www.example.com',\n    'DOMAIN-SUFFIX': 'example.com',\n    'DOMAIN-KEYWORD': 'example',\n    'DOMAIN-REGEX': '^ad\\\\..*\\\\.com$',\n    'GEOSITE': 'google',\n    'IP-CIDR': '192.168.0.0/16',\n    'IP-CIDR6': '2001:db8::/32',\n    'IP-SUFFIX': '8.8.8.8/24',\n    'GEOIP': 'CN',\n    'SRC-GEOIP': 'CN',\n    'DST-PORT': '443',\n    'SRC-PORT': '7777',\n    'PROCESS-NAME': 'curl',\n    'PROCESS-PATH': '/usr/bin/curl',\n    'RULE-SET': '模板 rule-providers 中的名称'\n};\nvar SP_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;\nvar SP_MAX_RULES = 500;\nvar SP_MAX_HOSTS_ENTRIES = 300;\nvar SP_TAG_COLORS = 6;\n\nfunction spBlankDialog() {\n    return {\n        open: false, kind: '', title: '', error: '', loading: false, confirmLabel: '',\n        editIndex: -1, subIndex: -1, subName: '', link: '', configId: '', copied: '',\n        groups: [], subtitle: ''\n    };\n}\n\nfunction spRandomId() {\n    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';\n    var bytes = new Uint8Array(12);\n    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {\n        crypto.getRandomValues(bytes);\n    } else {\n        for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);\n    }\n    var out = 'r_';\n    for (var j = 0; j < bytes.length; j++) out += chars.charAt(bytes[j] % chars.length);\n    return out;\n}\n\n/** 规则在服务端保存的字段（去掉草稿用的 _new/_deleted 等标记） */\nfunction spCleanRule(rule) {\n    var out = {\n        id: rule.id,\n        target: rule.target,\n        type: rule.type,\n        info: rule.info,\n        policy: rule.policy,\n        noResolve: !!rule.noResolve\n    };\n    if (rule.policy === 'NULL' && rule.prevPolicy) out.prevPolicy = rule.prevPolicy;\n    return out;\n}\n\nfunction spSameRuleContent(a, b) {\n    return !!a && !!b\n        && a.target === b.target\n        && a.type === b.type\n        && a.info === b.info\n        && a.policy === b.policy\n        && !!a.noResolve === !!b.noResolve;\n}\n\n/** 规则字段结构校验（与服务端 validateRuleStructure 保持一致） */\nfunction spRuleStructureError(rule) {\n    var info = String(rule.info || '').trim();\n    if (SP_RULE_TYPES.indexOf(rule.type) < 0) return '不支持的规则类型：' + (rule.type || '(空)');\n    if (!info) return '匹配内容不能为空';\n    if (/[\\s,]/.test(info)) return '匹配内容不能包含空格或逗号';\n    if ((rule.type === 'DST-PORT' || rule.type === 'SRC-PORT') && !/^\\d+(?:[-\\/]\\d+)*$/.test(info)) {\n        return '端口格式应为数字，例如 443 或 8000-9000';\n    }\n    if (!rule.policy) return '策略组不能为空';\n    return '';\n}\n\n/** 紧凑预览避开指针与插入线，并夹在视口内；触屏留出更大的手指间距。 */\nfunction spRuleDragPreviewPosition(x, y, width, height, viewportWidth, viewportHeight, touch, lineY) {\n    var margin = 8;\n    var gap = touch ? 32 : 16;\n    var clampTop = function (top) {\n        return Math.max(margin, Math.min(top, viewportHeight - height - margin));\n    };\n    var left = touch ? x - width / 2 : x + 16;\n    if (!touch && left + width > viewportWidth - margin) left = x - width - 16;\n    left = Math.max(margin, Math.min(left, viewportWidth - width - margin));\n\n    var above = y - height - gap;\n    var top = clampTop(above >= margin ? above : y + gap);\n    // 预览条不能压住插入线；上下放不下时（如横屏极矮窗口）优先保持在视口内。\n    if (top < lineY + 8 && top + height > lineY - 32) {\n        var aboveLine = lineY - height - 36;\n        var belowLine = lineY + 12;\n        if (aboveLine >= margin) top = clampTop(aboveLine);\n        else if (belowLine + height <= viewportHeight - margin) top = clampTop(belowLine);\n    }\n    return { left: left, top: top };\n}\n\nfunction appData() {\n    return {\n        // ---------- 认证 ----------\n        isAuthenticated: false,\n        checkingSession: true,\n        loginInput: '',\n        loginError: '',\n        loginLoading: false,\n        mustChangePassword: false,\n\n        // ---------- 导航与外观 ----------\n        activeTab: 'output',\n        sourceTab: 'sub',\n        ruleTab: 'rules',\n        theme: 'auto',\n        showSubModeHelp: false,\n\n        // ---------- 数据 ----------\n        subs: [],\n        nodes: [],\n        templates: [],\n        maxTemplates: 5,\n        outputConfigs: [],\n        activeConfigId: '',\n        dirtyConfigIds: {},\n        outputSaveQueue: [],\n        outputSaveInFlight: null,\n        outputSavePromise: null,\n        allGroups: [],\n        groupsByTemplate: {},\n        hostsConfig: { ipFilter: 'all', subs: [], staticContent: '', mergedCount: 0, maxEntries: SP_MAX_HOSTS_ENTRIES },\n\n        // ---------- 规则草稿（暂存后统一保存） ----------\n        ruleSaved: [],\n        ruleRevision: 0,\n        ruleDraft: [],\n        drag: { id: '' },\n\n        // ---------- 表单 ----------\n        ruleTypes: SP_RULE_TYPES,\n        ruleForm: { target: 'global', type: 'DOMAIN-SUFFIX', info: '', policy: 'DIRECT', noResolve: false },\n        editingRuleId: '',\n        ruleFormError: '',\n        policyPicker: { open: false, query: '', cursor: 0 },\n        hostsStaticDraft: '',\n        hostsValidationError: '',\n        hostsDetail: { name: '', updatedAt: '', entries: [], query: '', effectiveCount: 0, ipFilter: 'all' },\n        passwordForm: { next: '', confirm: '', error: '', ok: '' },\n        backupMsg: '',\n        subForm: { name: '', url: '', useProvider: true, autoUpdate: false },\n        nodeForm: { name: '', content: '' },\n        templateForm: { name: '', content: '' },\n        hostsForm: { name: '', url: '', autoUpdate: true },\n        pasteForm: { content: '' },\n        importForm: { target: 'global', content: '' },\n        previewContent: '',\n        skippedRuleNotice: null,\n\n        // ---------- 交互状态 ----------\n        busy: {\n            output: false, generate: false,\n            sub: false, subIndex: -1, subType: '',\n            node: false, template: false, rule: false,\n            hosts: false, hostsIndex: -1,\n            password: false, backup: false\n        },\n        dialog: spBlankDialog(),\n        toast: { show: false, message: '', type: '' },\n        toastTimer: null,\n\n        // ===================================================================\n        // 初始化\n        // ===================================================================\n        async init() {\n            var savedTheme = '';\n            try { savedTheme = localStorage.getItem('subpanel_theme') || ''; } catch (e) { savedTheme = ''; }\n            this.applyTheme(['auto', 'light', 'dark'].indexOf(savedTheme) >= 0 ? savedTheme : 'auto');\n\n            var hashTab = (location.hash || '').replace('#', '');\n            if (['output', 'sources', 'templates', 'rules', 'settings'].indexOf(hashTab) >= 0) {\n                this.activeTab = hashTab;\n            }\n\n            var self = this;\n            this.$watch('ruleForm.type', function () {\n                if (!self.ruleSupportsNoResolve) self.ruleForm.noResolve = false;\n            });\n            // 有未保存的规则或配置选择时，关闭/刷新页面前提示\n            window.addEventListener('beforeunload', function (event) {\n                if (self.isAuthenticated && (self.ruleDirtyCount > 0 || self.outputSaveQueue.length > 0 || self.outputSaveInFlight)) {\n                    event.preventDefault();\n                    event.returnValue = '';\n                }\n            });\n\n            await this.checkSession();\n        },\n\n        // ===================================================================\n        // 通用请求\n        // ===================================================================\n        async api(url, body, method) {\n            var options = {\n                method: method || (body === undefined ? 'GET' : 'POST'),\n                credentials: 'same-origin',\n                headers: {}\n            };\n            if (body !== undefined) {\n                options.headers['Content-Type'] = 'application/json';\n                options.body = JSON.stringify(body);\n            }\n            var res;\n            try {\n                res = await fetch(url, options);\n            } catch (e) {\n                throw new Error('网络请求失败，请检查连接');\n            }\n            var data = null;\n            try {\n                data = await res.json();\n            } catch (e) {\n                data = null;\n            }\n            if (res.status === 401 && url !== '/api/auth/verify') {\n                this.isAuthenticated = false;\n                throw new Error('登录已失效，请重新登录');\n            }\n            if (!res.ok) {\n                var err = new Error((data && data.error) || ('请求失败（' + res.status + '）'));\n                err.data = data;\n                err.status = res.status;\n                throw err;\n            }\n            return data || {};\n        },\n\n        notify(message, type) {\n            var self = this;\n            this.toast = { show: true, message: message, type: type || '' };\n            if (this.toastTimer) clearTimeout(this.toastTimer);\n            this.toastTimer = setTimeout(function () { self.toast.show = false; }, type === 'error' ? 4500 : 2600);\n        },\n\n        // ===================================================================\n        // 认证\n        // ===================================================================\n        async checkSession() {\n            this.checkingSession = true;\n            try {\n                var data = await this.api('/api/auth/session');\n                if (data.authenticated) {\n                    await this.loadState();\n                    this.isAuthenticated = true;\n                }\n            } catch (e) {\n                this.isAuthenticated = false;\n            } finally {\n                this.checkingSession = false;\n            }\n        },\n\n        async login() {\n            if (!this.loginInput || this.loginLoading) return;\n            this.loginLoading = true;\n            this.loginError = '';\n            try {\n                var data = await this.api('/api/auth/verify', { password: this.loginInput });\n                this.mustChangePassword = !!data.mustChangePassword;\n                await this.loadState();\n                this.isAuthenticated = true;\n                this.loginInput = '';\n                if (this.mustChangePassword) this.switchTab('settings');\n            } catch (e) {\n                this.isAuthenticated = false;\n                this.loginError = e.message || '登录失败';\n            } finally {\n                this.loginLoading = false;\n            }\n        },\n\n        async logout() {\n            if (!await this.flushOutputSaves()) return;\n            if (this.ruleDirtyCount > 0 && !confirm('规则附加还有未保存的修改，退出后将丢失。确定退出？')) return;\n            try { await this.api('/api/auth/logout', {}); } catch (e) { /* 忽略 */ }\n            this.isAuthenticated = false;\n            this.ruleDraft = this.cloneRules(this.ruleSaved);\n            this.finishDialog();\n        },\n\n        // ===================================================================\n        // 状态加载\n        // ===================================================================\n        async loadState() {\n            var data = await this.api('/api/state');\n            this.applyState(data);\n        },\n\n        applyState(data) {\n            this.mustChangePassword = !!data.mustChangePassword;\n            this.maxTemplates = data.maxTemplates || 5;\n            this.subs = data.subs || [];\n            this.nodes = data.nodes || [];\n            this.templates = data.templates || [];\n            if (data.ruleAppend) {\n                this.allGroups = data.ruleAppend.allGroups || [];\n                this.groupsByTemplate = data.ruleAppend.groupsByTemplate || {};\n                this.applyRuleConfig(data.ruleAppend.config, false);\n            }\n            if (data.hostsAppend) this.applyHostsConfig(data.hostsAppend);\n            this.setOutputConfigs(data.outputConfigs || []);\n            if (!this.isValidTarget(this.ruleForm.target)) this.ruleForm.target = 'global';\n        },\n\n        /**\n         * 应用服务端规则配置。\n         * force=false 时，若本地有未保存修改且服务端版本未变，则保留本地草稿。\n         */\n        applyRuleConfig(config, force) {\n            var cfg = config || { rules: [], revision: 0 };\n            var revision = Number(cfg.revision) || 0;\n            if (!force && this.ruleDirtyCount > 0 && revision === this.ruleRevision) return;\n            this.ruleSaved = this.cloneRules(cfg.rules || []);\n            this.ruleRevision = revision;\n            this.ruleDraft = this.cloneRules(cfg.rules || []);\n            if (this.editingRuleId && !this.ruleDraft.some(function (r) { return r.id === this.editingRuleId; }, this)) {\n                this.cancelEditRule();\n            }\n        },\n\n        applyHostsConfig(config) {\n            this.hostsConfig = config;\n            this.hostsStaticDraft = config.staticContent || '';\n            this.hostsValidationError = '';\n        },\n\n        setOutputConfigs(list) {\n            // 旧响应不能盖掉正在保存或尚未提交的本地选择。\n            var pending = (this.outputSaveInFlight ? [this.outputSaveInFlight] : []).concat(this.outputSaveQueue);\n            pending.forEach(function (item) {\n                var cfg = list.find(function (c) { return c.id === item.id; });\n                if (cfg) Object.assign(cfg, item.patch);\n            });\n            this.outputConfigs = list;\n            var self = this;\n            if (!list.some(function (c) { return c.id === self.activeConfigId; })) {\n                this.activeConfigId = list.length ? list[0].id : '';\n            }\n        },\n\n        async refreshTemplatesAndGroups() {\n            var data = await this.api('/api/state');\n            this.maxTemplates = data.maxTemplates || this.maxTemplates;\n            this.templates = data.templates || [];\n            this.allGroups = data.ruleAppend.allGroups || [];\n            this.groupsByTemplate = data.ruleAppend.groupsByTemplate || {};\n            this.applyRuleConfig(data.ruleAppend.config, false);\n            this.setOutputConfigs(data.outputConfigs || this.outputConfigs);\n            if (!this.isValidTarget(this.ruleForm.target)) this.ruleForm.target = 'global';\n        },\n\n        // ===================================================================\n        // 导航与外观\n        // ===================================================================\n        get navTabs() {\n            var self = this;\n            var orphan = this.ruleDraft.some(function (r) { return !r._deleted && self.isOrphanTarget(r.target); });\n            var ruleCount = this.ruleDraft.filter(function (r) { return !r._deleted; }).length;\n            return [\n                { key: 'output', label: '输出配置', shortLabel: '配置', icon: SP_ICONS.output, count: '' },\n                { key: 'sources', label: '节点来源', shortLabel: '节点', icon: SP_ICONS.sources, count: this.subs.length + this.nodes.length || '' },\n                { key: 'templates', label: '模板管理', shortLabel: '模板', icon: SP_ICONS.templates, count: this.templates.length || '' },\n                { key: 'rules', label: '规则与 Hosts', shortLabel: '规则', icon: SP_ICONS.rules, count: (this.ruleDirtyCount > 0 || orphan) ? '!' : (ruleCount || '') },\n                { key: 'settings', label: '设置', shortLabel: '设置', icon: SP_ICONS.settings, count: this.mustChangePassword ? '!' : '' }\n            ];\n        },\n\n        get currentTabLabel() {\n            var self = this;\n            var tab = this.navTabs.find(function (t) { return t.key === self.activeTab; });\n            return tab ? tab.label : '';\n        },\n\n        get topbarSubtitle() {\n            switch (this.activeTab) {\n                case 'output': return '组合订阅、模板与附加规则，生成可供客户端订阅的配置';\n                case 'sources': return '管理机场订阅与自建单节点';\n                case 'templates': return '维护配置模板与策略组';\n                case 'rules': return '逐条附加规则（暂存后统一保存），以及 Hosts 订阅与静态映射';\n                case 'settings': return '密码、外观与数据备份';\n                default: return '';\n            }\n        },\n\n        switchTab(key) {\n            if (this.activeTab === 'rules' && key !== 'rules' && this.ruleDirtyCount > 0) {\n                this.notify('规则附加有未保存的修改，记得回来保存', '');\n            }\n            this.activeTab = key;\n            this.policyPicker.open = false;\n            try { history.replaceState(null, '', '#' + key); } catch (e) { /* 忽略 */ }\n            window.scrollTo(0, 0);\n        },\n\n        goToRules() {\n            this.ruleTab = 'rules';\n            this.switchTab('rules');\n        },\n\n        applyTheme(theme) {\n            this.theme = theme;\n            if (theme === 'auto') {\n                document.documentElement.removeAttribute('data-theme');\n            } else {\n                document.documentElement.setAttribute('data-theme', theme);\n            }\n        },\n\n        setTheme(theme) {\n            this.applyTheme(theme);\n            try { localStorage.setItem('subpanel_theme', theme); } catch (e) { /* 忽略 */ }\n        },\n\n        cycleTheme() {\n            var order = ['auto', 'light', 'dark'];\n            this.setTheme(order[(order.indexOf(this.theme) + 1) % order.length]);\n        },\n\n        get themeLabel() {\n            return { auto: '跟随系统', light: '浅色', dark: '深色' }[this.theme];\n        },\n\n        get themeIcon() {\n            return { auto: '◐', light: '☀', dark: '☾' }[this.theme];\n        },\n\n        // ===================================================================\n        // 工具\n        // ===================================================================\n        truncate(text, max) {\n            var s = String(text || '');\n            return s.length > max ? s.slice(0, max) + '…' : s;\n        },\n\n        async copyText(text) {\n            var ok = false;\n            try {\n                await navigator.clipboard.writeText(text);\n                ok = true;\n            } catch (e) {\n                var ta = document.createElement('textarea');\n                ta.value = text;\n                ta.style.position = 'fixed';\n                ta.style.opacity = '0';\n                document.body.appendChild(ta);\n                ta.select();\n                try { ok = document.execCommand('copy'); } catch (err) { ok = false; }\n                document.body.removeChild(ta);\n            }\n            if (this.dialog.open && this.dialog.kind === 'link') {\n                this.dialog.copied = ok ? '已复制到剪贴板' : '';\n            }\n            this.notify(ok ? '已复制到剪贴板' : '复制失败，请手动选择复制', ok ? 'ok' : 'error');\n        },\n\n        markConfigsDirty(predicate) {\n            var next = Object.assign({}, this.dirtyConfigIds);\n            this.outputConfigs.forEach(function (cfg) {\n                if (cfg.hasGenerated && predicate(cfg)) next[cfg.id] = true;\n            });\n            this.dirtyConfigIds = next;\n        },\n\n        // ===================================================================\n        // 模板辅助\n        // ===================================================================\n        templateById(id) {\n            return this.templates.find(function (t) { return t.id === id; }) || null;\n        },\n\n        templateColor(id) {\n            var index = this.templates.findIndex(function (t) { return t.id === id; });\n            return index < 0 ? 0 : index % SP_TAG_COLORS;\n        },\n\n        isValidTarget(target) {\n            return target === 'global' || !!this.templateById(target);\n        },\n\n        isOrphanTarget(target) {\n            return target !== 'global' && !this.templateById(target);\n        },\n\n        targetLabel(target) {\n            if (target === 'global') return '全局';\n            var tpl = this.templateById(target);\n            return tpl ? tpl.name : '已删除的模板（不生效）';\n        },\n\n        targetTagClass(target) {\n            if (target === 'global') return 'tag-global';\n            if (this.isOrphanTarget(target)) return 'tag-orphan';\n            return 'tpl-c' + this.templateColor(target);\n        },\n\n        templateLabelById(id) {\n            if (!id) return '未选择模板';\n            var tpl = this.templateById(id);\n            return tpl ? tpl.name : '模板已删除';\n        },\n\n        get templatesOverLimit() {\n            return this.templates.length > this.maxTemplates;\n        },\n\n        /** 拥有某个策略组的模板列表（用于标签展示） */\n        groupOwners(group) {\n            var self = this;\n            return this.templates\n                .filter(function (t) { return (self.groupsByTemplate[t.id] || []).indexOf(group) >= 0; })\n                .map(function (t) { return { id: t.id, name: t.name, color: self.templateColor(t.id) }; });\n        },\n\n        groupsForTarget(target) {\n            if (target === 'global') return this.allGroups;\n            return this.groupsByTemplate[target] || [];\n        },\n\n        isPolicyAvailable(target, policy) {\n            if (SP_BUILTIN_POLICIES.indexOf(policy) >= 0) return true;\n            return this.groupsForTarget(target).indexOf(policy) >= 0;\n        },\n\n        // ===================================================================\n        // 输出配置\n        // ===================================================================\n        get activeConfig() {\n            var self = this;\n            return this.outputConfigs.find(function (c) { return c.id === self.activeConfigId; }) || null;\n        },\n\n        get generateBlockReason() {\n            var cfg = this.activeConfig;\n            if (!cfg) return '请先选择一个配置';\n            if (!cfg.templateId || !this.templateById(cfg.templateId)) return '请先选择模板';\n            if (cfg.subNames.length === 0 && cfg.nodeNames.length === 0) return '请至少勾选一个订阅或单节点';\n            return '';\n        },\n\n        get outputSelectionLocked() {\n            return this.busy.generate || this.busy.backup || (this.busy.output && !this.outputSavePromise);\n        },\n\n        get canGenerate() {\n            return !this.generateBlockReason;\n        },\n\n        configStatus(cfg) {\n            if (!cfg.templateId || !this.templateById(cfg.templateId)) {\n                return cfg.hasGenerated\n                    ? { text: '需选择模板', cls: 'badge-warn' }\n                    : { text: '未选模板', cls: 'badge-warn' };\n            }\n            if (!cfg.hasGenerated) return { text: '待生成', cls: 'badge-warn' };\n            if (this.dirtyConfigIds[cfg.id]) return { text: '待更新', cls: 'badge-warn' };\n            return { text: '已生成', cls: 'badge-ok' };\n        },\n\n        configLink(cfg) {\n            return location.origin + '/config=' + cfg.token;\n        },\n\n        selectOutputConfig(id) {\n            this.activeConfigId = id;\n            this.skippedRuleNotice = null;\n        },\n\n        saveActiveConfig(patch) {\n            var cfg = this.activeConfig;\n            if (!cfg || this.outputSelectionLocked) return Promise.resolve(false);\n            Object.assign(cfg, patch);\n            var queued = this.outputSaveQueue.find(function (item) { return item.id === cfg.id; });\n            if (queued) Object.assign(queued.patch, patch);\n            else this.outputSaveQueue.push({ id: cfg.id, patch: Object.assign({}, patch) });\n            this.markConfigsDirty(function (c) { return c.id === cfg.id; });\n            return this.flushOutputSaves();\n        },\n\n        /** 同一页面只串行发送一个保存请求；未发出的同配置修改合并提交。 */\n        flushOutputSaves() {\n            if (this.outputSavePromise) return this.outputSavePromise;\n            if (!this.outputSaveQueue.length) return Promise.resolve(true);\n            var self = this;\n            this.busy.output = true;\n            // 延迟到微任务开始，确保先记录 Promise，并合并同一轮交互产生的修改。\n            this.outputSavePromise = Promise.resolve().then(async function () {\n                while (self.outputSaveQueue.length) {\n                    var item = self.outputSaveQueue.shift();\n                    self.outputSaveInFlight = item;\n                    try {\n                        var data = await self.api('/api/output/save', Object.assign({ id: item.id }, item.patch));\n                        self.outputSaveInFlight = null;\n                        self.setOutputConfigs(data.configs);\n                    } catch (e) {\n                        self.outputSaveInFlight = null;\n                        var queued = self.outputSaveQueue.find(function (next) { return next.id === item.id; });\n                        if (queued) queued.patch = Object.assign({}, item.patch, queued.patch);\n                        else self.outputSaveQueue.unshift(item);\n                        self.notify('配置尚未保存：' + e.message + '。请重试，当前选择已保留。', 'error');\n                        return false;\n                    }\n                }\n                return true;\n            }).finally(function () {\n                self.outputSavePromise = null;\n                self.busy.output = false;\n            });\n            return this.outputSavePromise;\n        },\n\n        async addOutputConfig() {\n            if (this.busy.output || this.busy.generate || this.busy.backup) return;\n            if (!await this.flushOutputSaves()) return;\n            this.busy.output = true;\n            try {\n                var data = await this.api('/api/output/add', {});\n                this.setOutputConfigs(data.configs);\n                this.activeConfigId = data.config.id;\n                this.notify('已新增配置，请选择模板与节点来源', 'ok');\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                this.busy.output = false;\n            }\n        },\n\n        async deleteOutputConfig(id) {\n            if (this.busy.output || this.busy.generate || this.busy.backup) return;\n            if (!await this.flushOutputSaves()) return;\n            var cfg = this.outputConfigs.find(function (c) { return c.id === id; });\n            if (!cfg || !confirm('确定删除配置「' + cfg.name + '」？对应的订阅链接将立即失效。')) return;\n            this.busy.output = true;\n            try {\n                var data = await this.api('/api/output/delete', { id: id });\n                this.setOutputConfigs(data.configs);\n                this.notify('已删除', 'ok');\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                this.busy.output = false;\n            }\n        },\n\n        renameOutputConfig(name) {\n            var value = String(name || '').trim();\n            if (!value || !this.activeConfig || value === this.activeConfig.name) return;\n            this.saveActiveConfig({ name: value });\n        },\n\n        toggleConfigSub(name, checked) {\n            var cfg = this.activeConfig;\n            if (!cfg || this.outputSelectionLocked) return;\n            var list = cfg.subNames.filter(function (n) { return n !== name; });\n            if (checked) list.push(name);\n            cfg.subNames = list;\n            this.saveActiveConfig({ subNames: list });\n        },\n\n        toggleConfigNode(name, checked) {\n            var cfg = this.activeConfig;\n            if (!cfg || this.outputSelectionLocked) return;\n            var list = cfg.nodeNames.filter(function (n) { return n !== name; });\n            if (checked) list.push(name);\n            cfg.nodeNames = list;\n            this.saveActiveConfig({ nodeNames: list });\n        },\n\n        setConfigTemplate(id) {\n            if (!this.activeConfig || this.outputSelectionLocked) return;\n            this.activeConfig.templateId = id;\n            this.saveActiveConfig({ templateId: id });\n        },\n\n        toggleConfigRuleAppend(checked) {\n            if (!this.activeConfig || this.outputSelectionLocked) return;\n            this.activeConfig.ruleAppendEnabled = checked;\n            this.saveActiveConfig({ ruleAppendEnabled: checked });\n        },\n\n        toggleConfigHostsAppend(checked) {\n            if (!this.activeConfig || this.outputSelectionLocked) return;\n            this.activeConfig.hostsAppendEnabled = checked;\n            this.saveActiveConfig({ hostsAppendEnabled: checked });\n        },\n\n        async generateConfig() {\n            var cfg = this.activeConfig;\n            if (!cfg || this.busy.generate || this.busy.backup || (this.busy.output && !this.outputSavePromise) || !this.canGenerate) return;\n            this.busy.generate = true;\n            this.skippedRuleNotice = null;\n            try {\n                if (!await this.flushOutputSaves()) return;\n                cfg = this.outputConfigs.find(function (c) { return c.id === cfg.id; });\n                if (!cfg) return;\n                var data = await this.api('/api/output/generate', {\n                    id: cfg.id,\n                    subNames: cfg.subNames.slice(), nodeNames: cfg.nodeNames.slice(),\n                    templateId: cfg.templateId,\n                    ruleAppendEnabled: !!cfg.ruleAppendEnabled,\n                    hostsAppendEnabled: !!cfg.hostsAppendEnabled\n                });\n                this.setOutputConfigs(data.configs);\n                var nextDirty = Object.assign({}, this.dirtyConfigIds);\n                delete nextDirty[cfg.id];\n                this.dirtyConfigIds = nextDirty;\n\n                var skipped = data.skippedRules || [];\n                if (skipped.length > 0) {\n                    this.skippedRuleNotice = {\n                        title: '已生成，但有 ' + skipped.length + ' 条附加规则被跳过',\n                        detail: skipped.slice(0, 5).map(function (s) {\n                            return s.rule.type + ',' + s.rule.info + '：' + s.reason;\n                        }).join('；') + (skipped.length > 5 ? '……' : '')\n                    };\n                }\n                this.notify('配置已合成更新', 'ok');\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                this.busy.generate = false;\n            }\n        },\n\n        copyConfigLink() {\n            if (this.activeConfig) this.copyText(this.configLink(this.activeConfig));\n        },\n\n        openConfigLink(cfg) {\n            this.openDialog('link', '订阅链接 · ' + cfg.name, { link: this.configLink(cfg), configId: cfg.id });\n        },\n\n        async resetConfigToken() {\n            if (!await this.flushOutputSaves()) return;\n            if (!confirm('重置后旧链接立即失效，确定继续？')) return;\n            this.busy.output = true;\n            try {\n                var data = await this.api('/api/output/reset-token', { id: this.dialog.configId });\n                this.setOutputConfigs(data.configs);\n                this.dialog.link = this.configLink(data.config);\n                this.dialog.copied = '';\n                this.notify('Token 已重置', 'ok');\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                this.busy.output = false;\n            }\n        },\n\n        async previewConfig(id) {\n            try {\n                var data = await this.api('/api/output/preview', { id: id });\n                this.previewContent = data.content || '';\n                this.openDialog('preview', '预览 · ' + (data.config ? data.config.name : ''));\n            } catch (e) {\n                this.notify(e.message, 'error');\n            }\n        },\n\n        // ===================================================================\n        // 订阅\n        // ===================================================================\n        subStatusText(sub) {\n            if (sub.useProvider) {\n                return '由客户端拉取节点 · ' + (sub.autoUpdate ? '每小时自动更新' : '不自动更新');\n            }\n            if (sub.nodeCount > 0) {\n                return '节点列表 ' + sub.nodeCount + ' 个' + (sub.lastUpdate ? ' · 更新于 ' + sub.lastUpdate : '');\n            }\n            return '尚未获取节点，请刷新、上传或粘贴订阅内容';\n        },\n\n        openSubDialog(index) {\n            var editing = typeof index === 'number' && index >= 0;\n            var sub = editing ? this.subs[index] : null;\n            this.subForm = sub\n                ? { name: sub.name, url: sub.url, useProvider: sub.useProvider, autoUpdate: sub.autoUpdate }\n                : { name: '', url: '', useProvider: true, autoUpdate: false };\n            this.openDialog('sub', editing ? '编辑订阅' : '新增订阅', {\n                editIndex: editing ? index : -1,\n                confirmLabel: editing ? '保存' : '添加'\n            });\n        },\n\n        async submitSub(force) {\n            var editing = this.dialog.editIndex >= 0;\n            var oldName = editing ? this.subs[this.dialog.editIndex].name : '';\n            var payload = {\n                index: this.dialog.editIndex,\n                name: this.subForm.name.trim(),\n                url: this.subForm.url.trim(),\n                useProvider: !!this.subForm.useProvider,\n                autoUpdate: !!this.subForm.useProvider && !!this.subForm.autoUpdate,\n                force: !!force\n            };\n            if (!payload.name || !payload.url) {\n                this.dialog.error = '名称和订阅链接不能为空';\n                return;\n            }\n            try {\n                var data = await this.api(editing ? '/api/sub/update' : '/api/sub/add', payload);\n                this.subs = data.subs;\n                if (editing && oldName !== payload.name) await this.refreshOutputConfigs();\n                this.markConfigsDirty(function (c) { return c.subNames.indexOf(payload.name) >= 0; });\n                this.finishDialog();\n                this.notify(editing ? '订阅已更新' : '订阅已添加', 'ok');\n            } catch (e) {\n                if (e.data && e.data.confirmationNeeded && !force) {\n                    if (confirm(e.message + '\\n仍然保存？')) {\n                        await this.submitSub(true);\n                    } else {\n                        this.dialog.error = e.message;\n                    }\n                    return;\n                }\n                this.dialog.error = e.message;\n            }\n        },\n\n        async refreshOutputConfigs() {\n            var data = await this.api('/api/output/list');\n            this.setOutputConfigs(data.configs || []);\n        },\n\n        async setSubMode(index, useProvider) {\n            var sub = this.subs[index];\n            if (!sub || sub.useProvider === useProvider || this.busy.sub) return;\n            this.busy.sub = true;\n            try {\n                var data = await this.api('/api/sub/update', {\n                    index: index, name: sub.name, url: sub.url,\n                    useProvider: useProvider, autoUpdate: sub.autoUpdate\n                });\n                this.subs = data.subs;\n                this.markConfigsDirty(function (c) { return c.subNames.indexOf(sub.name) >= 0; });\n                var updated = this.subs[index];\n                if (!useProvider && !(updated && updated.nodeCount > 0)) {\n                    this.notify('已切换为节点列表，请刷新或上传以获取节点', '');\n                } else {\n                    this.notify(useProvider ? '已切换为 Provider 托管' : '已切换为节点列表', 'ok');\n                }\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                this.busy.sub = false;\n            }\n        },\n\n        async runSubParse(index, source, extra) {\n            var sub = this.subs[index];\n            if (!sub || this.busy.sub) return false;\n            this.busy.sub = true;\n            this.busy.subIndex = index;\n            this.busy.subType = source;\n            try {\n                var data = await this.api('/api/sub/parse', Object.assign({\n                    index: index, subName: sub.name, source: source\n                }, extra || {}));\n                this.subs = data.subs;\n                this.markConfigsDirty(function (c) { return c.subNames.indexOf(sub.name) >= 0; });\n                this.notify('解析成功：' + data.nodeCount + ' 个节点', 'ok');\n                return true;\n            } catch (e) {\n                this.notify(e.message, 'error');\n                return false;\n            } finally {\n                this.busy.sub = false;\n                this.busy.subIndex = -1;\n                this.busy.subType = '';\n            }\n        },\n\n        updateSubFromUrl(index) {\n            this.runSubParse(index, 'url');\n        },\n\n        async uploadSubFile(index, event) {\n            var input = event.target;\n            var file = input.files && input.files[0];\n            if (!file) return;\n            try {\n                if (!/\\.(?:ya?ml|txt)$/i.test(file.name)) throw new Error('仅支持 YAML、YML 或 TXT 文件');\n                if (file.size > SP_MAX_UPLOAD_BYTES) throw new Error('订阅文件不能超过 2 MiB');\n                var buffer = await file.arrayBuffer();\n                var content;\n                try {\n                    content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);\n                } catch (e) {\n                    throw new Error('文件必须使用 UTF-8 编码');\n                }\n                await this.runSubParse(index, 'file', { fileName: file.name, content: content });\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                input.value = '';\n            }\n        },\n\n        openPasteDialog(index) {\n            var sub = this.subs[index];\n            if (!sub) return;\n            this.pasteForm = { content: '' };\n            this.openDialog('paste', '粘贴订阅内容', { subIndex: index, subName: sub.name, confirmLabel: '解析并更新' });\n        },\n\n        async submitPaste() {\n            var content = this.pasteForm.content;\n            if (!content.trim()) {\n                this.dialog.error = '订阅内容不能为空';\n                return;\n            }\n            if (new TextEncoder().encode(content).byteLength > SP_MAX_UPLOAD_BYTES) {\n                this.dialog.error = '订阅内容超过 2 MiB 限制';\n                return;\n            }\n            var sub = this.subs[this.dialog.subIndex];\n            if (!sub || sub.name !== this.dialog.subName) {\n                this.dialog.error = '订阅信息已变化，请关闭后重试';\n                return;\n            }\n            var ok = await this.runSubParse(this.dialog.subIndex, 'text', { content: content });\n            if (ok) this.finishDialog();\n        },\n\n        async deleteSub(index) {\n            var sub = this.subs[index];\n            if (!sub || !confirm('确定删除订阅「' + sub.name + '」？引用它的配置会同步移除该订阅。')) return;\n            this.busy.sub = true;\n            try {\n                var data = await this.api('/api/sub/delete', { index: index });\n                this.subs = data.subs;\n                this.markConfigsDirty(function (c) { return c.subNames.indexOf(sub.name) >= 0; });\n                await this.refreshOutputConfigs();\n                this.notify('已删除', 'ok');\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                this.busy.sub = false;\n            }\n        },\n\n        // ===================================================================\n        // 单节点\n        // ===================================================================\n        openNodeDialog(index) {\n            var editing = typeof index === 'number' && index >= 0;\n            var node = editing ? this.nodes[index] : null;\n            this.nodeForm = node ? { name: node.name, content: node.content } : { name: '', content: '' };\n            this.openDialog('node', editing ? '编辑单节点' : '新增单节点', {\n                editIndex: editing ? index : -1,\n                confirmLabel: editing ? '保存' : '添加'\n            });\n        },\n\n        async submitNode() {\n            var editing = this.dialog.editIndex >= 0;\n            var oldName = editing ? this.nodes[this.dialog.editIndex].name : '';\n            var payload = {\n                index: this.dialog.editIndex,\n                name: this.nodeForm.name.trim(),\n                content: this.nodeForm.content.trim()\n            };\n            if (!payload.name || !payload.content) {\n                this.dialog.error = '名称和内容不能为空';\n                return;\n            }\n            try {\n                var data = await this.api(editing ? '/api/node/update' : '/api/node/add', payload);\n                this.nodes = data.nodes;\n                if (editing && oldName !== payload.name) await this.refreshOutputConfigs();\n                this.markConfigsDirty(function (c) { return c.nodeNames.indexOf(payload.name) >= 0; });\n                this.finishDialog();\n                this.notify(editing ? '节点已更新' : '节点已添加', 'ok');\n            } catch (e) {\n                this.dialog.error = e.message;\n            }\n        },\n\n        async deleteNode(index) {\n            var node = this.nodes[index];\n            if (!node || !confirm('确定删除节点「' + node.name + '」？')) return;\n            this.busy.node = true;\n            try {\n                var data = await this.api('/api/node/delete', { index: index });\n                this.nodes = data.nodes;\n                this.markConfigsDirty(function (c) { return c.nodeNames.indexOf(node.name) >= 0; });\n                await this.refreshOutputConfigs();\n                this.notify('已删除', 'ok');\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                this.busy.node = false;\n            }\n        },\n\n        // ===================================================================\n        // 模板\n        // ===================================================================\n        async openTemplateDialog(index) {\n            var editing = typeof index === 'number' && index >= 0;\n            var tpl = editing ? this.templates[index] : null;\n            this.templateForm = { name: tpl ? tpl.name : '', content: '' };\n            if (tpl) {\n                if (tpl.type === 'url') {\n                    this.templateForm.content = tpl.url;\n                } else {\n                    this.busy.template = true;\n                    try {\n                        var detail = await this.api('/api/template/detail', { id: tpl.id });\n                        this.templateForm.content = detail.content || '';\n                    } catch (e) {\n                        this.notify(e.message, 'error');\n                        return;\n                    } finally {\n                        this.busy.template = false;\n                    }\n                }\n            }\n            this.openDialog('template', editing ? '编辑模板' : '新增模板', {\n                editIndex: editing ? index : -1,\n                confirmLabel: editing ? '保存' : '添加'\n            });\n        },\n\n        async submitTemplate() {\n            var editing = this.dialog.editIndex >= 0;\n            var payload = {\n                index: this.dialog.editIndex,\n                name: this.templateForm.name.trim(),\n                content: this.templateForm.content.trim()\n            };\n            if (!payload.name || !payload.content) {\n                this.dialog.error = '名称和内容不能为空';\n                return;\n            }\n            var tplId = editing ? this.templates[this.dialog.editIndex].id : '';\n            try {\n                await this.api(editing ? '/api/template/update' : '/api/template/add', payload);\n                await this.refreshTemplatesAndGroups();\n                if (tplId) this.markConfigsDirty(function (c) { return c.templateId === tplId; });\n                this.finishDialog();\n                this.notify(editing ? '模板已更新' : '模板已添加', 'ok');\n            } catch (e) {\n                this.dialog.error = e.message;\n            }\n        },\n\n        async refreshTemplate(index) {\n            var tpl = this.templates[index];\n            if (!tpl) return;\n            this.busy.template = true;\n            try {\n                await this.api('/api/template/refresh', { index: index });\n                await this.refreshTemplatesAndGroups();\n                this.markConfigsDirty(function (c) { return c.templateId === tpl.id; });\n                this.notify('模板已刷新', 'ok');\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                this.busy.template = false;\n            }\n        },\n\n        async deleteTemplate(index) {\n            var tpl = this.templates[index];\n            if (!tpl) return;\n            var bound = this.ruleDraft.filter(function (r) { return !r._deleted && r.target === tpl.id; }).length;\n            var used = this.outputConfigs.filter(function (c) { return c.templateId === tpl.id; }).length;\n            var msg = '确定删除模板「' + tpl.name + '」？';\n            if (used > 0) msg += '\\n有 ' + used + ' 个配置正在使用它，删除后将变为「未选择模板」（已生成的内容和订阅链接保留，重新选择模板并合成后才会更新）。';\n            if (bound > 0) msg += '\\n另有 ' + bound + ' 条规则绑定在该模板上，删除后将不再生效，可在规则列表中重新指定。';\n            if (!confirm(msg)) return;\n            this.busy.template = true;\n            try {\n                await this.api('/api/template/delete', { index: index });\n                await this.refreshTemplatesAndGroups();\n                this.notify('模板已删除', 'ok');\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                this.busy.template = false;\n            }\n        },\n\n        viewTemplateGroups(tpl) {\n            this.openDialog('groups', '策略组 · ' + tpl.name, {\n                groups: tpl.groups || [],\n                subtitle: '共 ' + (tpl.groups || []).length + ' 个策略组，可在规则附加中选用。'\n            });\n        },\n\n        // ===================================================================\n        // 规则附加：表单与策略组选择器\n        // ===================================================================\n        get ruleSupportsNoResolve() {\n            return SP_NO_RESOLVE_TYPES.indexOf(this.ruleForm.type) >= 0;\n        },\n\n        get ruleInfoPlaceholder() {\n            return SP_RULE_PLACEHOLDERS[this.ruleForm.type] || '';\n        },\n\n        /** 当前表单所选策略不在「应用到」对应模板中时的提示 */\n        get ruleFormPolicyError() {\n            if (!this.isValidTarget(this.ruleForm.target)) return '';\n            if (this.isPolicyAvailable(this.ruleForm.target, this.ruleForm.policy)) return '';\n            var where = this.ruleForm.target === 'global' ? '任何模板' : '模板「' + this.targetLabel(this.ruleForm.target) + '」';\n            return where + '中没有策略组「' + this.ruleForm.policy + '」，请重新选择';\n        },\n\n        policyDisplay(policy) {\n            return policy === 'NULL' ? 'NULL（暂不启用）' : policy;\n        },\n\n        /** 选择器触发按钮上展示的模板标签：仅「全局」时显示该策略组所属模板 */\n        policyTriggerOwners() {\n            if (this.ruleForm.target !== 'global') return [];\n            if (SP_BUILTIN_POLICIES.indexOf(this.ruleForm.policy) >= 0) return [];\n            return this.groupOwners(this.ruleForm.policy);\n        },\n\n        get policyPickerOptions() {\n            var self = this;\n            var query = String(this.policyPicker.query || '').trim().toLowerCase();\n            var match = function (name) { return !query || name.toLowerCase().indexOf(query) >= 0; };\n            var showOwners = this.ruleForm.target === 'global';\n            var options = [];\n\n            SP_BUILTIN_POLICIES.filter(match).forEach(function (name, i) {\n                options.push({\n                    value: name, label: self.policyDisplay(name), section: 'builtin',\n                    sectionStart: i === 0, owners: []\n                });\n            });\n            var groups = this.groupsForTarget(this.ruleForm.target).filter(function (g) {\n                return SP_BUILTIN_POLICIES.indexOf(g) < 0 && match(g);\n            });\n            groups.forEach(function (name, i) {\n                options.push({\n                    value: name, label: name, section: 'group', sectionStart: i === 0,\n                    owners: showOwners ? self.groupOwners(name) : []\n                });\n            });\n            return options;\n        },\n\n        togglePolicyPicker() {\n            if (this.policyPicker.open) {\n                this.closePolicyPicker(false);\n            } else {\n                this.openPolicyPicker();\n            }\n        },\n\n        openPolicyPicker() {\n            var self = this;\n            this.policyPicker.query = '';\n            this.policyPicker.open = true;\n            var index = this.policyPickerOptions.findIndex(function (o) { return o.value === self.ruleForm.policy; });\n            this.policyPicker.cursor = index < 0 ? 0 : index;\n            this.$nextTick(function () {\n                var search = document.getElementById('policy-search');\n                if (search) search.focus();\n                self.scrollPolicyCursorIntoView();\n            });\n        },\n\n        closePolicyPicker(refocus) {\n            this.policyPicker.open = false;\n            if (refocus) {\n                var trigger = document.getElementById('rule-policy');\n                if (trigger) trigger.focus();\n            }\n        },\n\n        movePolicyCursor(delta) {\n            var total = this.policyPickerOptions.length;\n            if (total === 0) return;\n            this.policyPicker.cursor = (this.policyPicker.cursor + delta + total) % total;\n            var self = this;\n            this.$nextTick(function () { self.scrollPolicyCursorIntoView(); });\n        },\n\n        scrollPolicyCursorIntoView() {\n            var el = document.querySelector('[data-policy-index=\"' + this.policyPicker.cursor + '\"]');\n            if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });\n        },\n\n        pickPolicyAtCursor() {\n            var option = this.policyPickerOptions[this.policyPicker.cursor];\n            if (option) this.pickPolicy(option.value);\n        },\n\n        pickPolicy(value) {\n            this.ruleForm.policy = value;\n            this.closePolicyPicker(true);\n        },\n\n        // ===================================================================\n        // 规则附加：草稿（暂存）与统一保存\n        // ===================================================================\n        cloneRules(list) {\n            return (list || []).map(function (rule) {\n                var copy = spCleanRule(rule);\n                if (rule.prevPolicy) copy.prevPolicy = rule.prevPolicy;\n                return copy;\n            });\n        },\n\n        savedRule(id) {\n            return this.ruleSaved.find(function (r) { return r.id === id; }) || null;\n        },\n\n        isRuleModified(rule) {\n            if (rule._new || rule._deleted) return false;\n            var saved = this.savedRule(rule.id);\n            return !!saved && !spSameRuleContent(saved, rule);\n        },\n\n        get ruleOrderChanged() {\n            var draftIds = this.ruleDraft\n                .filter(function (r) { return !r._new && !r._deleted; })\n                .map(function (r) { return r.id; });\n            var keep = {};\n            draftIds.forEach(function (id) { keep[id] = true; });\n            var savedIds = this.ruleSaved\n                .filter(function (r) { return keep[r.id]; })\n                .map(function (r) { return r.id; });\n            return draftIds.join('|') !== savedIds.join('|');\n        },\n\n        /** 未保存的修改数：新增 + 删除 + 修改 +（顺序变化计 1） */\n        get ruleDirtyCount() {\n            var self = this;\n            var count = 0;\n            this.ruleDraft.forEach(function (rule) {\n                if (rule._new) {\n                    if (!rule._deleted) count++;\n                } else if (rule._deleted || self.isRuleModified(rule)) {\n                    count++;\n                }\n            });\n            if (this.ruleOrderChanged) count++;\n            return count;\n        },\n\n        /** 会阻止保存的错误：结构错误；新增/修改过的规则目标或策略组无效 */\n        ruleBlockingError(rule) {\n            if (rule._deleted) return '';\n            var structure = spRuleStructureError(rule);\n            if (structure) return structure;\n            if (!rule._new && !this.isRuleModified(rule)) return '';\n            if (!this.isValidTarget(rule.target)) return '目标模板不存在，请编辑后重新选择「应用到」';\n            if (rule.policy !== 'NULL' && !this.isPolicyAvailable(rule.target, rule.policy)) {\n                return '策略组「' + rule.policy + '」在所选范围中不存在';\n            }\n            return '';\n        },\n\n        get ruleInvalidCount() {\n            var self = this;\n            return this.ruleDraft.filter(function (r) { return !!self.ruleBlockingError(r); }).length;\n        },\n\n        /** 不阻止保存、但生成时会被跳过的提示 */\n        ruleWarning(rule) {\n            if (rule._deleted || rule.policy === 'NULL' || this.ruleBlockingError(rule)) return '';\n            if (this.isOrphanTarget(rule.target)) return '';\n            if (SP_BUILTIN_POLICIES.indexOf(rule.policy) >= 0) return '';\n            var self = this;\n            if (rule.target === 'global') {\n                var missing = this.templates.filter(function (t) {\n                    return (self.groupsByTemplate[t.id] || []).indexOf(rule.policy) < 0;\n                });\n                if (missing.length === 0) return '';\n                if (missing.length === this.templates.length) return '所有模板中都没有策略组「' + rule.policy + '」，生成时会跳过';\n                return '模板 ' + missing.map(function (t) { return '「' + t.name + '」'; }).join('') + ' 中没有此策略组，使用这些模板的配置会跳过这条规则';\n            }\n            if ((this.groupsByTemplate[rule.target] || []).indexOf(rule.policy) < 0) {\n                return '模板「' + this.targetLabel(rule.target) + '」中没有策略组「' + rule.policy + '」，生成时会跳过';\n            }\n            return '';\n        },\n\n        ruleRowClass(rule) {\n            return {\n                'is-new': !!rule._new && !rule._deleted,\n                'is-modified': this.isRuleModified(rule),\n                'is-deleted': !!rule._deleted,\n                'is-disabled': rule.policy === 'NULL',\n                'is-invalid': !!this.ruleBlockingError(rule),\n                'is-dragging': this.drag.id === rule.id,\n                'is-editing': this.editingRuleId === rule.id\n            };\n        },\n\n        /** 规则在最终顺序中的序号（待删除的不计） */\n        ruleOrderNumber(rule) {\n            if (rule._deleted) return '–';\n            var n = 0;\n            for (var i = 0; i < this.ruleDraft.length; i++) {\n                if (!this.ruleDraft[i]._deleted) n++;\n                if (this.ruleDraft[i].id === rule.id) return n;\n            }\n            return '';\n        },\n\n        get editingRuleNumber() {\n            return this.editingRuleId ? this.ruleOrderNumber({ id: this.editingRuleId }) : '';\n        },\n\n        get activeRuleCount() {\n            return this.ruleDraft.filter(function (r) { return !r._deleted; }).length;\n        },\n\n        ruleLineText(rule) {\n            var line = rule.type + ',' + rule.info + ',' + rule.policy;\n            if (rule.noResolve) line += ',no-resolve';\n            return line;\n        },\n\n        /** 把表单内容暂存到草稿（新增或更新），不写服务端 */\n        stageRule() {\n            var self = this;\n            var form = {\n                target: this.ruleForm.target,\n                type: this.ruleForm.type,\n                info: String(this.ruleForm.info || '').trim(),\n                policy: this.ruleForm.policy,\n                noResolve: this.ruleSupportsNoResolve && !!this.ruleForm.noResolve\n            };\n\n            var error = spRuleStructureError(form);\n            if (!error && !this.isValidTarget(form.target)) error = '请选择有效的「应用到」范围';\n            if (!error && this.ruleFormPolicyError) error = this.ruleFormPolicyError;\n            if (!error) {\n                var duplicate = this.ruleDraft.find(function (r) {\n                    return !r._deleted && r.id !== self.editingRuleId\n                        && r.target === form.target && r.type === form.type && r.info === form.info;\n                });\n                if (duplicate) error = '已存在相同目标的规则（第 ' + this.ruleOrderNumber(duplicate) + ' 条），可直接编辑那一条';\n            }\n            if (!error && !this.editingRuleId && this.activeRuleCount >= SP_MAX_RULES) {\n                error = '规则最多 ' + SP_MAX_RULES + ' 条';\n            }\n            this.ruleFormError = error;\n            if (error) return;\n\n            if (this.editingRuleId) {\n                var rule = this.ruleDraft.find(function (r) { return r.id === self.editingRuleId; });\n                if (rule) {\n                    if (form.policy !== 'NULL') delete rule.prevPolicy;\n                    Object.assign(rule, form);\n                }\n                this.editingRuleId = '';\n                this.notify('已更新到列表，记得「保存全部」', '');\n            } else {\n                this.ruleDraft.push(Object.assign({ id: spRandomId(), _new: true }, form));\n                this.notify('已添加到列表，记得「保存全部」', '');\n            }\n            this.ruleForm.info = '';\n        },\n\n        editRule(rule) {\n            if (rule._deleted) return;\n            this.editingRuleId = rule.id;\n            this.ruleFormError = '';\n            var orphan = this.isOrphanTarget(rule.target);\n            this.ruleForm = {\n                target: orphan ? 'global' : rule.target,\n                type: rule.type,\n                info: rule.info,\n                policy: rule.policy,\n                noResolve: !!rule.noResolve\n            };\n            if (orphan) this.ruleFormError = '原绑定的模板已被删除，请重新选择「应用到」范围后更新';\n            this.$nextTick(function () {\n                window.scrollTo({ top: 0, behavior: 'smooth' });\n                var el = document.getElementById('rule-info');\n                if (el) el.focus();\n            });\n        },\n\n        cancelEditRule() {\n            this.editingRuleId = '';\n            this.ruleFormError = '';\n            this.ruleForm.info = '';\n        },\n\n        removeRule(rule) {\n            if (this.editingRuleId === rule.id) this.cancelEditRule();\n            if (rule._new) {\n                this.ruleDraft = this.ruleDraft.filter(function (r) { return r.id !== rule.id; });\n            } else {\n                rule._deleted = true;\n            }\n        },\n\n        restoreRule(rule) {\n            rule._deleted = false;\n        },\n\n        toggleRuleNull(rule) {\n            if (rule._deleted) return;\n            if (rule.policy === 'NULL') {\n                if (!rule.prevPolicy) {\n                    this.editRule(rule);\n                    this.notify('请为这条规则选择一个策略组后更新', '');\n                    return;\n                }\n                rule.policy = rule.prevPolicy;\n                delete rule.prevPolicy;\n            } else {\n                rule.prevPolicy = rule.policy;\n                rule.policy = 'NULL';\n            }\n        },\n\n        clearAllRules() {\n            if (this.activeRuleCount === 0) return;\n            if (!confirm('把全部 ' + this.activeRuleCount + ' 条规则标记为删除？点击「保存全部」后才会真正删除。')) return;\n            this.cancelEditRule();\n            this.ruleDraft = this.ruleDraft\n                .filter(function (r) { return !r._new; })\n                .map(function (r) { r._deleted = true; return r; });\n        },\n\n        discardRuleDraft() {\n            if (this.ruleDirtyCount > 0 && !confirm('放弃全部 ' + this.ruleDirtyCount + ' 处未保存的修改？')) return;\n            this.ruleDraft = this.cloneRules(this.ruleSaved);\n            this.cancelEditRule();\n        },\n\n        async saveRuleDraft() {\n            if (this.busy.rule || this.ruleDirtyCount === 0) return;\n            if (this.ruleInvalidCount > 0) {\n                this.notify('还有 ' + this.ruleInvalidCount + ' 条规则需要修正', 'error');\n                return;\n            }\n            this.busy.rule = true;\n            try {\n                var rules = this.ruleDraft\n                    .filter(function (r) { return !r._deleted; })\n                    .map(spCleanRule);\n                var data = await this.api('/api/rule-append/save', { baseRevision: this.ruleRevision, rules: rules });\n                this.allGroups = data.allGroups || this.allGroups;\n                this.groupsByTemplate = data.groupsByTemplate || this.groupsByTemplate;\n                this.applyRuleConfig(data.config, true);\n                this.cancelEditRule();\n                this.markConfigsDirty(function (c) { return c.ruleAppendEnabled; });\n                this.notify('规则已保存', 'ok');\n            } catch (e) {\n                if (e.data && e.data.conflict) {\n                    if (confirm(e.message + '\\n\\n是否立即加载最新的规则？')) {\n                        this.applyRuleConfig(e.data.config, true);\n                        this.cancelEditRule();\n                    }\n                } else {\n                    this.notify(e.message, 'error');\n                }\n            } finally {\n                this.busy.rule = false;\n            }\n        },\n\n        // ---------- 拖动排序 ----------\n        // 拖动期间不修改数据、不触发重渲染：只移动紧凑预览条和插入线，松手时一次提交。\n        // 命中判定用「行位置快照 + 插入序号」，而不是 elementFromPoint，\n        // 因此一次甩到列表另一端可一步到位；绘制放在 rAF 里，事件频率不影响手感。\n        startRuleDrag(event, id) {\n            if (event.pointerType === 'mouse' && event.button !== 0) return;\n            var self = this;\n            var sourceIndex = this.ruleDraft.findIndex(function (r) { return r.id === id; });\n            if (this.drag.id || sourceIndex < 0 || this.ruleDraft[sourceIndex]._deleted) return;\n\n            var rowEl = event.currentTarget.closest('[data-rule-id]');\n            var listEl = document.getElementById('rule-list');\n            var indicator = document.getElementById('rule-drag-indicator');\n            var layer = document.getElementById('rule-drag-layer');\n            if (!rowEl || !listEl || !indicator || !layer) return;\n\n            event.preventDefault();\n            var handle = event.currentTarget;\n            var pointerId = event.pointerId;\n            var rule = this.ruleDraft[sourceIndex];\n            var touch = event.pointerType === 'touch';\n\n            // 快照所有行的位置（容器局部坐标，不受页面滚动影响）\n            var listRect = listEl.getBoundingClientRect();\n            var others = [];\n            var rowEls = listEl.querySelectorAll('[data-rule-id]');\n            for (var i = 0; i < rowEls.length; i++) {\n                var rowId = rowEls[i].getAttribute('data-rule-id');\n                if (rowId === id) continue;\n                var box = rowEls[i].getBoundingClientRect();\n                others.push({\n                    top: box.top - listRect.top,\n                    bottom: box.bottom - listRect.top,\n                    deleted: !!this.ruleDraft[i]._deleted\n                });\n            }\n\n            // 只创建一条精简预览，不克隆整行（不会遮盖大片内容，也不会复制 Alpine 指令）。\n            // 所有用户内容使用 textContent，避免被当作 HTML 执行。\n            var ghost = document.createElement('div');\n            ghost.className = 'rule-drag-preview';\n            var source = document.createElement('span');\n            source.className = 'rule-drag-source';\n            source.textContent = '#' + this.ruleOrderNumber(rule);\n            var summary = document.createElement('span');\n            summary.className = 'rule-drag-summary';\n            summary.textContent = rule.type + ' · ' + rule.info;\n            var destination = document.createElement('span');\n            destination.className = 'rule-drag-destination';\n            ghost.appendChild(source);\n            ghost.appendChild(summary);\n            ghost.appendChild(destination);\n            layer.appendChild(ghost);\n            var dropLabel = indicator.querySelector('.rule-drop-label');\n            destination.textContent = '→ 第 ' + this.ruleOrderNumber(rule) + ' 位';\n            var previewRect = ghost.getBoundingClientRect();\n\n            var pointerX = event.clientX;\n            var pointerY = event.clientY;\n            var currentDrop = sourceIndex;\n            var rafId = 0;\n            var lastFrameTime = null;\n            var dragging = true;\n\n            indicator.classList.add('is-active');\n\n            var paint = function () {\n                var liveRect = listEl.getBoundingClientRect();\n                var localY = pointerY - liveRect.top;\n\n                // 插入位置 = 中线在指针上方的行数（不含被拖行）\n                var drop = 0;\n                for (var k = 0; k < others.length; k++) {\n                    if (localY > (others[k].top + others[k].bottom) / 2) drop = k + 1;\n                }\n                currentDrop = drop;\n\n                var boundary = others.length === 0\n                    ? 0\n                    : (drop >= others.length ? others[others.length - 1].bottom : others[drop].top);\n\n                var number = 1;\n                for (var n = 0; n < drop; n++) {\n                    if (!others[n].deleted) number++;\n                }\n                var caption = '第 ' + number + ' 位';\n                destination.textContent = '→ ' + caption;\n                if (dropLabel) dropLabel.textContent = '放到' + caption;\n                indicator.style.transform = 'translate3d(0,' + boundary + 'px,0)';\n                var position = spRuleDragPreviewPosition(\n                    pointerX, pointerY, previewRect.width, previewRect.height,\n                    window.innerWidth, window.innerHeight, touch, liveRect.top + boundary\n                );\n                ghost.style.transform = 'translate3d(' + position.left + 'px,' + position.top + 'px,0)';\n            };\n\n            // 按真实经过时间计算滚动距离（px/s），60Hz / 120Hz 设备的速度一致。\n            var tick = function (time) {\n                if (!dragging) return;\n                var elapsed = lastFrameTime === null ? 0 : Math.min(50, Math.max(0, time - lastFrameTime));\n                lastFrameTime = time;\n                var edge = 90;\n                var maxSpeed = 900;\n                var vh = window.innerHeight;\n                var speed = 0;\n                if (pointerY < edge) speed = -maxSpeed * Math.min(1, Math.max(0, 1 - pointerY / edge));\n                else if (pointerY > vh - edge) speed = maxSpeed * Math.min(1, Math.max(0, 1 - (vh - pointerY) / edge));\n                if (speed !== 0 && elapsed > 0) window.scrollBy(0, speed * elapsed / 1000);\n                paint();\n                rafId = window.requestAnimationFrame(tick);\n            };\n\n            var onMove = function (e) {\n                if (e.pointerId !== pointerId) return;\n                pointerX = e.clientX;\n                pointerY = e.clientY;\n            };\n\n            var teardown = function () {\n                if (!dragging) return;\n                dragging = false;\n                if (rafId) window.cancelAnimationFrame(rafId);\n                handle.removeEventListener('pointermove', onMove);\n                handle.removeEventListener('pointerup', onUp);\n                handle.removeEventListener('pointercancel', onCancel);\n                handle.removeEventListener('lostpointercapture', onCancel);\n                window.removeEventListener('blur', onCancel);\n                document.removeEventListener('keydown', onKeyDown, true);\n                try { handle.releasePointerCapture(pointerId); } catch (err) { /* 忽略 */ }\n                if (ghost.parentNode) ghost.parentNode.removeChild(ghost);\n                indicator.classList.remove('is-active');\n                document.body.classList.remove('is-dragging-rule');\n                self.drag.id = '';\n            };\n\n            var onUp = function (e) {\n                if (e.pointerId !== pointerId) return;\n                // 松手事件可能发生在下一帧绘制之前，按最终指针位置计算，避免落点滞后一帧。\n                pointerX = e.clientX;\n                pointerY = e.clientY;\n                paint();\n                var dropAt = currentDrop;\n                teardown();\n                self.applyRuleMove(id, dropAt);\n            };\n\n            var onCancel = function () { teardown(); };\n\n            var onKeyDown = function (e) {\n                if (e.key === 'Escape') {\n                    e.preventDefault();\n                    teardown();\n                }\n            };\n\n            this.drag.id = id;\n            document.body.classList.add('is-dragging-rule');\n            try { handle.setPointerCapture(pointerId); } catch (e) { /* 忽略 */ }\n            handle.addEventListener('pointermove', onMove);\n            handle.addEventListener('pointerup', onUp);\n            handle.addEventListener('pointercancel', onCancel);\n            handle.addEventListener('lostpointercapture', onCancel);\n            window.addEventListener('blur', onCancel);\n            document.addEventListener('keydown', onKeyDown, true);\n\n            // 首次定位直接落在当前边界，避免插入线从上一次的位置横穿列表。\n            indicator.style.transition = 'none';\n            paint();\n            indicator.getBoundingClientRect();\n            indicator.style.transition = '';\n            rafId = window.requestAnimationFrame(tick);\n        },\n\n        /** 把规则移到「移除后列表」的第 dropIndex 位（0..n），一次可跨多行 */\n        applyRuleMove(id, dropIndex) {\n            var list = this.ruleDraft.slice();\n            var from = list.findIndex(function (r) { return r.id === id; });\n            if (from < 0) return;\n            var max = list.length - 1;\n            var target = Math.max(0, Math.min(Number(dropIndex) || 0, max));\n            if (target === from) return;\n            var moved = list.splice(from, 1)[0];\n            list.splice(target, 0, moved);\n            this.ruleDraft = list;\n        },\n\n        /** 键盘排序：在拖动手柄上按 ↑/↓ */\n        nudgeRule(id, delta) {\n            var index = this.ruleDraft.findIndex(function (r) { return r.id === id; });\n            if (index < 0) return;\n            this.applyRuleMove(id, index + delta);\n            this.$nextTick(function () {\n                var handle = document.querySelector('[data-rule-id=\"' + id + '\"] .drag-handle');\n                if (handle) handle.focus();\n            });\n        },\n\n        // ---------- 批量导入（解析到草稿） ----------\n        openImportDialog() {\n            this.importForm = {\n                target: this.isValidTarget(this.ruleForm.target) ? this.ruleForm.target : 'global',\n                content: ''\n            };\n            this.openDialog('import', '批量导入规则', { confirmLabel: '导入到列表' });\n        },\n\n        async submitImport() {\n            var self = this;\n            var target = this.importForm.target;\n            if (!this.isValidTarget(target)) {\n                this.dialog.error = '请选择有效的导入范围';\n                return;\n            }\n            var imported = [];\n            var problems = [];\n            var lines = String(this.importForm.content || '').split(/\\r?\\n/);\n            lines.forEach(function (raw, idx) {\n                var line = raw.trim();\n                if (!line || line.charAt(0) === '#') return;\n                var parts = line.split(',').map(function (p) { return p.trim(); });\n                var lineNo = idx + 1;\n                if (parts.length < 3) {\n                    problems.push(lineNo + '（格式）');\n                    return;\n                }\n                var type = parts[0].toUpperCase();\n                if (type === 'IPCIDR') type = 'IP-CIDR';\n                var rule = {\n                    id: spRandomId(), _new: true, target: target, type: type, info: parts[1], policy: parts[2],\n                    noResolve: SP_NO_RESOLVE_TYPES.indexOf(type) >= 0 && String(parts[3] || '').toLowerCase() === 'no-resolve'\n                };\n                var error = spRuleStructureError(rule);\n                if (error) {\n                    problems.push(lineNo + '（' + error + '）');\n                    return;\n                }\n                if (rule.policy !== 'NULL' && !self.isPolicyAvailable(target, rule.policy)) {\n                    problems.push(lineNo + '（策略组「' + rule.policy + '」不存在）');\n                    return;\n                }\n                imported.push(rule);\n            });\n\n            if (imported.length === 0) {\n                this.dialog.error = problems.length ? '没有可导入的规则。问题行：' + problems.slice(0, 6).join('、') : '请粘贴规则文本';\n                return;\n            }\n            if (this.activeRuleCount + imported.length > SP_MAX_RULES) {\n                this.dialog.error = '导入后将超过 ' + SP_MAX_RULES + ' 条上限';\n                return;\n            }\n            this.ruleDraft = this.ruleDraft.concat(imported);\n            this.finishDialog();\n            var msg = '已导入 ' + imported.length + ' 条到列表，记得「保存全部」';\n            if (problems.length) msg += '；跳过第 ' + problems.slice(0, 6).join('、') + ' 行';\n            this.notify(msg, problems.length ? '' : 'ok');\n        },\n\n        // ===================================================================\n        // Hosts 附加\n        // ===================================================================\n        afterHostsChanged() {\n            this.markConfigsDirty(function (c) { return c.hostsAppendEnabled; });\n        },\n\n        get hostsMaxEntries() {\n            return this.hostsConfig.maxEntries || SP_MAX_HOSTS_ENTRIES;\n        },\n\n        /** 静态 Hosts 输入框中的有效行数（忽略空行与注释） */\n        get staticHostsCount() {\n            return String(this.hostsStaticDraft || '').split(/\\r?\\n/).filter(function (line) {\n                var t = line.trim();\n                return t && t.charAt(0) !== '#';\n            }).length;\n        },\n\n        openHostsDialog(index) {\n            var editing = typeof index === 'number' && index >= 0;\n            var sub = editing ? this.hostsConfig.subs[index] : null;\n            this.hostsForm = sub\n                ? { name: sub.name, url: '', autoUpdate: sub.autoUpdate }\n                : { name: '', url: '', autoUpdate: true };\n            this.openDialog('hosts', editing ? '编辑 Hosts 订阅源' : '新增 Hosts 订阅源', {\n                editIndex: editing ? index : -1,\n                confirmLabel: editing ? '保存' : '添加并拉取'\n            });\n        },\n\n        async submitHosts() {\n            var editing = this.dialog.editIndex >= 0;\n            var payload = {\n                index: this.dialog.editIndex,\n                name: this.hostsForm.name.trim(),\n                url: this.hostsForm.url.trim(),\n                autoUpdate: !!this.hostsForm.autoUpdate\n            };\n            if (!payload.name || (!editing && !payload.url)) {\n                this.dialog.error = '名称和订阅链接不能为空';\n                return;\n            }\n            try {\n                var data = await this.api('/api/hosts-append/sub/save', payload);\n                this.applyHostsConfig(data.config);\n                this.afterHostsChanged();\n                this.finishDialog();\n                this.notify(editing ? '已保存' : '已添加', 'ok');\n            } catch (e) {\n                this.dialog.error = e.message;\n            }\n        },\n\n        async openHostsDetail(index) {\n            var sub = this.hostsConfig.subs[index];\n            if (!sub) return;\n            this.busy.hosts = true;\n            this.busy.hostsIndex = index;\n            try {\n                var data = await this.api('/api/hosts-append/sub/detail', { index: index });\n                this.hostsDetail = {\n                    name: data.name,\n                    updatedAt: data.updatedAt || '',\n                    entries: data.entries || [],\n                    query: '',\n                    effectiveCount: data.effectiveCount || 0,\n                    ipFilter: data.ipFilter || 'all'\n                };\n                this.openDialog('hostsDetail', '订阅内容 · ' + data.name);\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                this.busy.hosts = false;\n                this.busy.hostsIndex = -1;\n            }\n        },\n\n        /** 查看弹窗中按搜索词过滤后的 hosts 行（IP 域名） */\n        get hostsDetailText() {\n            var query = String(this.hostsDetail.query || '').trim().toLowerCase();\n            var lines = [];\n            this.hostsDetail.entries.forEach(function (entry) {\n                (entry.ips || []).forEach(function (ip) {\n                    var line = ip + '  ' + entry.domain;\n                    if (!query || line.toLowerCase().indexOf(query) >= 0) lines.push(line);\n                });\n            });\n            return lines.length ? lines.join('\\n') : (query ? '没有匹配的条目' : '（无内容）');\n        },\n\n        get hostsFilterLabel() {\n            return { all: '全部', ipv4: '仅 IPv4', ipv6: '仅 IPv6' }[this.hostsDetail.ipFilter] || '全部';\n        },\n\n        async toggleHostsAuto(index) {\n            var sub = this.hostsConfig.subs[index];\n            if (!sub) return;\n            this.busy.hosts = true;\n            try {\n                var data = await this.api('/api/hosts-append/sub/toggle-auto', { index: index, autoUpdate: !sub.autoUpdate });\n                this.applyHostsConfig(data.config);\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                this.busy.hosts = false;\n            }\n        },\n\n        async refreshHostsSub(index) {\n            this.busy.hosts = true;\n            this.busy.hostsIndex = index;\n            try {\n                var data = await this.api('/api/hosts-append/sub/refresh', { index: index });\n                this.applyHostsConfig(data.config);\n                this.afterHostsChanged();\n                this.notify('已刷新：' + data.domainCount + ' 个域名', 'ok');\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                this.busy.hosts = false;\n                this.busy.hostsIndex = -1;\n            }\n        },\n\n        async deleteHostsSub(index) {\n            var sub = this.hostsConfig.subs[index];\n            if (!sub || !confirm('确定删除 Hosts 订阅源「' + sub.name + '」？')) return;\n            this.busy.hosts = true;\n            try {\n                var data = await this.api('/api/hosts-append/sub/delete', { index: index });\n                this.applyHostsConfig(data.config);\n                this.afterHostsChanged();\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                this.busy.hosts = false;\n            }\n        },\n\n        async setHostsIpFilter(filter) {\n            if (filter === this.hostsConfig.ipFilter) return;\n            this.busy.hosts = true;\n            try {\n                var draft = this.hostsStaticDraft;\n                var data = await this.api('/api/hosts-append/save', {\n                    ipFilter: filter,\n                    staticContent: this.hostsConfig.staticContent\n                });\n                this.applyHostsConfig(data.config);\n                this.hostsStaticDraft = draft;\n                this.afterHostsChanged();\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                this.busy.hosts = false;\n            }\n        },\n\n        async saveStaticHosts() {\n            this.hostsValidationError = '';\n            if (this.staticHostsCount > this.hostsMaxEntries) {\n                this.hostsValidationError = '静态 Hosts 超过 ' + this.hostsMaxEntries + ' 条上限（当前 ' + this.staticHostsCount + ' 条）';\n                return;\n            }\n            this.busy.hosts = true;\n            try {\n                var data = await this.api('/api/hosts-append/save', {\n                    ipFilter: this.hostsConfig.ipFilter,\n                    staticContent: this.hostsStaticDraft\n                });\n                this.applyHostsConfig(data.config);\n                this.afterHostsChanged();\n                this.notify('静态 Hosts 已保存', 'ok');\n            } catch (e) {\n                var errors = e.data && e.data.validation && e.data.validation.errors;\n                this.hostsValidationError = errors && errors.length ? errors.slice(0, 3).join('；') : e.message;\n            } finally {\n                this.busy.hosts = false;\n            }\n        },\n\n        // ===================================================================\n        // 设置\n        // ===================================================================\n        async changePassword() {\n            var form = this.passwordForm;\n            form.error = '';\n            form.ok = '';\n            if (form.next.length < 6) {\n                form.error = '新密码至少 6 位';\n                return;\n            }\n            if (form.next !== form.confirm) {\n                form.error = '两次输入的密码不一致';\n                return;\n            }\n            this.busy.password = true;\n            try {\n                await this.api('/api/auth/password', { newPassword: form.next });\n                this.passwordForm = { next: '', confirm: '', error: '', ok: '密码已更新，其他设备上的登录会话已失效。' };\n                this.mustChangePassword = false;\n            } catch (e) {\n                form.error = e.message;\n            } finally {\n                this.busy.password = false;\n            }\n        },\n\n        async exportBackup() {\n            if (!await this.flushOutputSaves()) return;\n            this.busy.backup = true;\n            this.backupMsg = '';\n            try {\n                var data = await this.api('/api/backup/export');\n                var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });\n                var url = URL.createObjectURL(blob);\n                var a = document.createElement('a');\n                var stamp = new Date().toISOString().slice(0, 10);\n                a.href = url;\n                a.download = 'subpanel-backup-' + stamp + '.json';\n                document.body.appendChild(a);\n                a.click();\n                document.body.removeChild(a);\n                setTimeout(function () { URL.revokeObjectURL(url); }, 1000);\n                this.backupMsg = '备份已导出，请妥善保管（包含订阅链接与 Token）。';\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                this.busy.backup = false;\n            }\n        },\n\n        async importBackup(event) {\n            var input = event.target;\n            var file = input.files && input.files[0];\n            if (!file) return;\n            this.backupMsg = '';\n            try {\n                // 最多 5 份 4 MiB 节点缓存 + 5 份 2 MiB 模板及元数据。\n                if (file.size > 40 * 1024 * 1024) throw new Error('备份文件过大（上限 40 MiB）');\n                var parsed;\n                try {\n                    parsed = JSON.parse(await file.text());\n                } catch (e) {\n                    throw new Error('备份文件不是有效 JSON');\n                }\n                var msg = '导入会覆盖备份中包含的数据（订阅、节点、模板、规则、Hosts、配置）。导入的输出配置将清理旧 YAML，完成后需重新合成。确定继续？';\n                if (this.ruleDirtyCount > 0) msg += '\\n规则附加中未保存的修改也会被丢弃。';\n                if (!confirm(msg)) return;\n                if (!await this.flushOutputSaves()) return;\n                this.busy.backup = true;\n                await this.api('/api/backup/import', parsed);\n                var data = await this.api('/api/state');\n                this.applyState(data);\n                this.applyRuleConfig(data.ruleAppend.config, true);\n                this.backupMsg = '导入完成。如配置内容有变化，请重新「合成更新」。';\n            } catch (e) {\n                this.notify(e.message, 'error');\n            } finally {\n                this.busy.backup = false;\n                input.value = '';\n            }\n        },\n\n        // ===================================================================\n        // 弹窗\n        // ===================================================================\n        openDialog(kind, title, extra) {\n            this.dialog = Object.assign(spBlankDialog(), { open: true, kind: kind, title: title }, extra || {});\n        },\n\n        closeDialog() {\n            if (this.dialog.loading) return;\n            this.dialog = spBlankDialog();\n        },\n\n        finishDialog() {\n            this.dialog = spBlankDialog();\n        },\n\n        async submitDialog() {\n            if (this.dialog.loading) return;\n            this.dialog.error = '';\n            this.dialog.loading = true;\n            try {\n                switch (this.dialog.kind) {\n                    case 'sub': await this.submitSub(false); break;\n                    case 'node': await this.submitNode(); break;\n                    case 'template': await this.submitTemplate(); break;\n                    case 'hosts': await this.submitHosts(); break;\n                    case 'paste': await this.submitPaste(); break;\n                    case 'import': await this.submitImport(); break;\n                    default: break;\n                }\n            } finally {\n                // 提交成功时 finishDialog 已重置 dialog；失败时解除 loading 以便重试\n                if (this.dialog.open) this.dialog.loading = false;\n            }\n        }\n    };\n}\n";

// ====== [MODULE: 14_worker.js] ======
// ============================================================================
// Worker 入口：静态页面、前端资源代理、订阅配置拉取、API 分发、Cron
// ============================================================================

/**
 * 运行时前端资源（Alpine.js）：优先边缘 Cache API，失败时依次回退多个源。
 * 使用 caches.default 减少跨区域回源次数。
 */
async function serveRuntimeAsset(url, asset) {
    const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
    const cacheKey = new Request(url.toString(), { method: 'GET' });

    if (cache) {
        try {
            const hit = await cache.match(cacheKey);
            if (hit) return hit;
        } catch (e) {
            // 忽略缓存读取异常，继续回源
        }
    }

    let lastError = '';
    for (const remoteUrl of asset.urls) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch(remoteUrl, { signal: controller.signal });
            if (!res.ok) {
                lastError = `HTTP ${res.status}`;
                continue;
            }
            const text = await res.text();
            if (!text || text.length < 100) {
                lastError = '响应内容过短';
                continue;
            }
            const response = new Response(text, {
                headers: {
                    'Content-Type': asset.contentType,
                    'Cache-Control': 'public, max-age=86400'
                }
            });
            if (cache) {
                try {
                    await cache.put(cacheKey, response.clone());
                } catch (e) {
                    // 忽略缓存写入异常
                }
            }
            return response;
        } catch (e) {
            lastError = e && e.name === 'AbortError' ? '超时' : (e.message || '请求失败');
        } finally {
            clearTimeout(timeoutId);
        }
    }

    const body = DEBUG
        ? `console.error(${JSON.stringify(`前端资源加载失败 ${url.pathname}: ${lastError}`)});`
        : `/* 前端资源加载失败: ${lastError} */`;
    return new Response(body, {
        status: DEBUG ? 200 : 502,
        headers: { 'Content-Type': asset.contentType }
    });
}

let cachedPageHtml = '';

/** 组装管理页：用函数替换，避免脚本中的 $& / $' 等被当作特殊替换序列 */
function getPageHtml() {
    if (cachedPageHtml) return cachedPageHtml;
    cachedPageHtml = HTML_CONTENT
        .replace('__DEBUG_PANEL_STYLE__', () => (DEBUG ? DEBUG_PANEL_STYLE : ''))
        .replace('__DEBUG_PANEL_SCRIPT__', () => (DEBUG ? DEBUG_PANEL_SCRIPT : ''))
        .replace('__DEBUG_PANEL_BODY__', () => (DEBUG ? DEBUG_PANEL_BODY : ''))
        .replace('__CLIENT_SCRIPT__', () => CLIENT_SCRIPT);
    return cachedPageHtml;
}

export default {
    /** Cron 触发：检查并刷新到期 Hosts 订阅（每次只重建 1 个配置以摊平 CPU） */
    async scheduled(event, env, ctx) {
        const task = autoUpdateHosts(env, { updateConfigs: true, maxRebuild: 1 })
            .catch(e => reportBackgroundError('Hosts Cron 更新', e));
        if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(task);
        } else {
            await task;
        }
    },

    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // 1. 前端资源代理
        if (method === 'GET' && RUNTIME_ASSETS[path]) {
            return await serveRuntimeAsset(url, RUNTIME_ASSETS[path]);
        }

        // 2. 管理页面
        if (path === '/' && method === 'GET') {
            return new Response(getPageHtml(), {
                headers: {
                    'Content-Type': 'text/html;charset=UTF-8',
                    'Cache-Control': 'no-store'
                }
            });
        }

        // 3. 订阅配置拉取 /config=<token>
        if (path.startsWith('/config')) {
            const prefix = '/config=';
            const token = path.startsWith(prefix) ? path.slice(prefix.length) : '';
            if (!token) {
                return new Response('Unauthorized: Invalid Config Token', { status: 403 });
            }

            const config = await findOutputConfigByToken(env, token);
            if (!config) {
                return new Response('Unauthorized: Invalid Config Token', { status: 403 });
            }

            // 后台异步检查 Hosts 是否需要更新，不阻塞客户端响应
            const updateTask = autoUpdateHosts(env, { updateConfigs: true, maxRebuild: 1 })
                .catch(e => reportBackgroundError('Hosts 后台更新', e));
            if (ctx && typeof ctx.waitUntil === 'function') {
                ctx.waitUntil(updateTask);
            } else {
                await updateTask;
            }

            const content = await readGeneratedConfig(env, config);
            return new Response(content || '# No config generated yet', {
                headers: {
                    'Content-Type': 'text/yaml;charset=UTF-8',
                    'Cache-Control': 'no-store'
                }
            });
        }

        // 4. API 分发
        if (path.startsWith('/api/')) {
            return await handleApi(request, env, ctx, url);
        }

        return new Response('Not Found', { status: 404 });
    }
};
