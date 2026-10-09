"use strict";(()=>{var rt=null,on=new Set;function rs(){for(let r of on)r()}typeof window<"u"&&(window.addEventListener("beforeinstallprompt",r=>{r.preventDefault(),rt=r,rs()}),window.addEventListener("appinstalled",()=>{rt=null,rs()}));function ns(){return rt!==null}function an(r){on.add(r)}async function ln(){if(!rt)return!1;let r=rt;rt=null,await r.prompt();let e=await r.userChoice;return rs(),e.outcome==="accepted"}var ti=globalThis,ii=ti.ShadowRoot&&(ti.ShadyCSS===void 0||ti.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,os=Symbol(),hn=new WeakMap,Ft=class{constructor(e,t,i){if(this._$cssResult$=!0,i!==os)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o,t=this.t;if(ii&&e===void 0){let i=t!==void 0&&t.length===1;i&&(e=hn.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),i&&hn.set(t,e))}return e}toString(){return this.cssText}},cn=r=>new Ft(typeof r=="string"?r:r+"",void 0,os),S=(r,...e)=>{let t=r.length===1?r[0]:e.reduce(((i,s,n)=>i+(o=>{if(o._$cssResult$===!0)return o.cssText;if(typeof o=="number")return o;throw Error("Value passed to 'css' function must be a 'css' function result: "+o+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+r[n+1]),r[0]);return new Ft(t,r,os)},as=(r,e)=>{if(ii)r.adoptedStyleSheets=e.map((t=>t instanceof CSSStyleSheet?t:t.styleSheet));else for(let t of e){let i=document.createElement("style"),s=ti.litNonce;s!==void 0&&i.setAttribute("nonce",s),i.textContent=t.cssText,r.appendChild(i)}},si=ii?r=>r:r=>r instanceof CSSStyleSheet?(e=>{let t="";for(let i of e.cssRules)t+=i.cssText;return cn(t)})(r):r;var{is:la,defineProperty:ha,getOwnPropertyDescriptor:ca,getOwnPropertyNames:da,getOwnPropertySymbols:ua,getPrototypeOf:pa}=Object,ri=globalThis,dn=ri.trustedTypes,fa=dn?dn.emptyScript:"",ma=ri.reactiveElementPolyfillSupport,Mt=(r,e)=>r,Ct={toAttribute(r,e){switch(e){case Boolean:r=r?fa:null;break;case Object:case Array:r=r==null?r:JSON.stringify(r)}return r},fromAttribute(r,e){let t=r;switch(e){case Boolean:t=r!==null;break;case Number:t=r===null?null:Number(r);break;case Object:case Array:try{t=JSON.parse(r)}catch{t=null}}return t}},ni=(r,e)=>!la(r,e),un={attribute:!0,type:String,converter:Ct,reflect:!1,hasChanged:ni};Symbol.metadata??=Symbol("metadata"),ri.litPropertyMetadata??=new WeakMap;var Fe=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=un){if(t.state&&(t.attribute=!1),this._$Ei(),this.elementProperties.set(e,t),!t.noAccessor){let i=Symbol(),s=this.getPropertyDescriptor(e,i,t);s!==void 0&&ha(this.prototype,e,s)}}static getPropertyDescriptor(e,t,i){let{get:s,set:n}=ca(this.prototype,e)??{get(){return this[t]},set(o){this[t]=o}};return{get(){return s?.call(this)},set(o){let a=s?.call(this);n.call(this,o),this.requestUpdate(e,a,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??un}static _$Ei(){if(this.hasOwnProperty(Mt("elementProperties")))return;let e=pa(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(Mt("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Mt("properties"))){let t=this.properties,i=[...da(t),...ua(t)];for(let s of i)this.createProperty(s,t[s])}let e=this[Symbol.metadata];if(e!==null){let t=litPropertyMetadata.get(e);if(t!==void 0)for(let[i,s]of t)this.elementProperties.set(i,s)}this._$Eh=new Map;for(let[t,i]of this.elementProperties){let s=this._$Eu(t,i);s!==void 0&&this._$Eh.set(s,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let t=[];if(Array.isArray(e)){let i=new Set(e.flat(1/0).reverse());for(let s of i)t.unshift(si(s))}else e!==void 0&&t.push(si(e));return t}static _$Eu(e,t){let i=t.attribute;return i===!1?void 0:typeof i=="string"?i:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise((e=>this.enableUpdating=e)),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach((e=>e(this)))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=new Map,t=this.constructor.elementProperties;for(let i of t.keys())this.hasOwnProperty(i)&&(e.set(i,this[i]),delete this[i]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return as(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach((e=>e.hostConnected?.()))}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach((e=>e.hostDisconnected?.()))}attributeChangedCallback(e,t,i){this._$AK(e,i)}_$EC(e,t){let i=this.constructor.elementProperties.get(e),s=this.constructor._$Eu(e,i);if(s!==void 0&&i.reflect===!0){let n=(i.converter?.toAttribute!==void 0?i.converter:Ct).toAttribute(t,i.type);this._$Em=e,n==null?this.removeAttribute(s):this.setAttribute(s,n),this._$Em=null}}_$AK(e,t){let i=this.constructor,s=i._$Eh.get(e);if(s!==void 0&&this._$Em!==s){let n=i.getPropertyOptions(s),o=typeof n.converter=="function"?{fromAttribute:n.converter}:n.converter?.fromAttribute!==void 0?n.converter:Ct;this._$Em=s,this[s]=o.fromAttribute(t,n.type),this._$Em=null}}requestUpdate(e,t,i){if(e!==void 0){if(i??=this.constructor.getPropertyOptions(e),!(i.hasChanged??ni)(this[e],t))return;this.P(e,t,i)}this.isUpdatePending===!1&&(this._$ES=this._$ET())}P(e,t,i){this._$AL.has(e)||this._$AL.set(e,t),i.reflect===!0&&this._$Em!==e&&(this._$Ej??=new Set).add(e)}async _$ET(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[s,n]of this._$Ep)this[s]=n;this._$Ep=void 0}let i=this.constructor.elementProperties;if(i.size>0)for(let[s,n]of i)n.wrapped!==!0||this._$AL.has(s)||this[s]===void 0||this.P(s,this[s],n)}let e=!1,t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach((i=>i.hostUpdate?.())),this.update(t)):this._$EU()}catch(i){throw e=!1,this._$EU(),i}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach((t=>t.hostUpdated?.())),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EU(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Ej&&=this._$Ej.forEach((t=>this._$EC(t,this[t]))),this._$EU()}updated(e){}firstUpdated(e){}};Fe.elementStyles=[],Fe.shadowRootOptions={mode:"open"},Fe[Mt("elementProperties")]=new Map,Fe[Mt("finalized")]=new Map,ma?.({ReactiveElement:Fe}),(ri.reactiveElementVersions??=[]).push("2.0.4");var fs=globalThis,oi=fs.trustedTypes,pn=oi?oi.createPolicy("lit-html",{createHTML:r=>r}):void 0,yn="$lit$",Ne=`lit$${Math.random().toFixed(9).slice(2)}$`,vn="?"+Ne,ga=`<${vn}>`,Ke=document,Pt=()=>Ke.createComment(""),At=r=>r===null||typeof r!="object"&&typeof r!="function",ms=Array.isArray,ba=r=>ms(r)||typeof r?.[Symbol.iterator]=="function",ls=`[ 	
\f\r]`,Et=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,fn=/-->/g,mn=/>/g,Ge=RegExp(`>|${ls}(?:([^\\s"'>=/]+)(${ls}*=${ls}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),gn=/'/g,bn=/"/g,xn=/^(?:script|style|textarea|title)$/i,gs=r=>(e,...t)=>({_$litType$:r,strings:e,values:t}),p=gs(1),U=gs(2),yl=gs(3),Qe=Symbol.for("lit-noChange"),g=Symbol.for("lit-nothing"),wn=new WeakMap,Ze=Ke.createTreeWalker(Ke,129);function Sn(r,e){if(!ms(r)||!r.hasOwnProperty("raw"))throw Error("invalid template strings array");return pn!==void 0?pn.createHTML(e):e}var wa=(r,e)=>{let t=r.length-1,i=[],s,n=e===2?"<svg>":e===3?"<math>":"",o=Et;for(let a=0;a<t;a++){let l=r[a],c,d,u=-1,m=0;for(;m<l.length&&(o.lastIndex=m,d=o.exec(l),d!==null);)m=o.lastIndex,o===Et?d[1]==="!--"?o=fn:d[1]!==void 0?o=mn:d[2]!==void 0?(xn.test(d[2])&&(s=RegExp("</"+d[2],"g")),o=Ge):d[3]!==void 0&&(o=Ge):o===Ge?d[0]===">"?(o=s??Et,u=-1):d[1]===void 0?u=-2:(u=o.lastIndex-d[2].length,c=d[1],o=d[3]===void 0?Ge:d[3]==='"'?bn:gn):o===bn||o===gn?o=Ge:o===fn||o===mn?o=Et:(o=Ge,s=void 0);let f=o===Ge&&r[a+1].startsWith("/>")?" ":"";n+=o===Et?l+ga:u>=0?(i.push(c),l.slice(0,u)+yn+l.slice(u)+Ne+f):l+Ne+(u===-2?a:f)}return[Sn(r,n+(r[t]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),i]},qt=class r{constructor({strings:e,_$litType$:t},i){let s;this.parts=[];let n=0,o=0,a=e.length-1,l=this.parts,[c,d]=wa(e,t);if(this.el=r.createElement(c,i),Ze.currentNode=this.el.content,t===2||t===3){let u=this.el.content.firstChild;u.replaceWith(...u.childNodes)}for(;(s=Ze.nextNode())!==null&&l.length<a;){if(s.nodeType===1){if(s.hasAttributes())for(let u of s.getAttributeNames())if(u.endsWith(yn)){let m=d[o++],f=s.getAttribute(u).split(Ne),$=/([.?@])?(.*)/.exec(m);l.push({type:1,index:n,name:$[2],strings:f,ctor:$[1]==="."?cs:$[1]==="?"?ds:$[1]==="@"?us:ot}),s.removeAttribute(u)}else u.startsWith(Ne)&&(l.push({type:6,index:n}),s.removeAttribute(u));if(xn.test(s.tagName)){let u=s.textContent.split(Ne),m=u.length-1;if(m>0){s.textContent=oi?oi.emptyScript:"";for(let f=0;f<m;f++)s.append(u[f],Pt()),Ze.nextNode(),l.push({type:2,index:++n});s.append(u[m],Pt())}}}else if(s.nodeType===8)if(s.data===vn)l.push({type:2,index:n});else{let u=-1;for(;(u=s.data.indexOf(Ne,u+1))!==-1;)l.push({type:7,index:n}),u+=Ne.length-1}n++}}static createElement(e,t){let i=Ke.createElement("template");return i.innerHTML=e,i}};function nt(r,e,t=r,i){if(e===Qe)return e;let s=i!==void 0?t._$Co?.[i]:t._$Cl,n=At(e)?void 0:e._$litDirective$;return s?.constructor!==n&&(s?._$AO?.(!1),n===void 0?s=void 0:(s=new n(r),s._$AT(r,t,i)),i!==void 0?(t._$Co??=[])[i]=s:t._$Cl=s),s!==void 0&&(e=nt(r,s._$AS(r,e.values),s,i)),e}var hs=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:t},parts:i}=this._$AD,s=(e?.creationScope??Ke).importNode(t,!0);Ze.currentNode=s;let n=Ze.nextNode(),o=0,a=0,l=i[0];for(;l!==void 0;){if(o===l.index){let c;l.type===2?c=new Tt(n,n.nextSibling,this,e):l.type===1?c=new l.ctor(n,l.name,l.strings,this,e):l.type===6&&(c=new ps(n,this,e)),this._$AV.push(c),l=i[++a]}o!==l?.index&&(n=Ze.nextNode(),o++)}return Ze.currentNode=Ke,s}p(e){let t=0;for(let i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(e,i,t),t+=i.strings.length-2):i._$AI(e[t])),t++}},Tt=class r{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,i,s){this.type=2,this._$AH=g,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=nt(this,e,t),At(e)?e===g||e==null||e===""?(this._$AH!==g&&this._$AR(),this._$AH=g):e!==this._$AH&&e!==Qe&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):ba(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==g&&At(this._$AH)?this._$AA.nextSibling.data=e:this.T(Ke.createTextNode(e)),this._$AH=e}$(e){let{values:t,_$litType$:i}=e,s=typeof i=="number"?this._$AC(e):(i.el===void 0&&(i.el=qt.createElement(Sn(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(t);else{let n=new hs(s,this),o=n.u(this.options);n.p(t),this.T(o),this._$AH=n}}_$AC(e){let t=wn.get(e.strings);return t===void 0&&wn.set(e.strings,t=new qt(e)),t}k(e){ms(this._$AH)||(this._$AH=[],this._$AR());let t=this._$AH,i,s=0;for(let n of e)s===t.length?t.push(i=new r(this.O(Pt()),this.O(Pt()),this,this.options)):i=t[s],i._$AI(n),s++;s<t.length&&(this._$AR(i&&i._$AB.nextSibling,s),t.length=s)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e&&e!==this._$AB;){let i=e.nextSibling;e.remove(),e=i}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},ot=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,i,s,n){this.type=1,this._$AH=g,this._$AN=void 0,this.element=e,this.name=t,this._$AM=s,this.options=n,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=g}_$AI(e,t=this,i,s){let n=this.strings,o=!1;if(n===void 0)e=nt(this,e,t,0),o=!At(e)||e!==this._$AH&&e!==Qe,o&&(this._$AH=e);else{let a=e,l,c;for(e=n[0],l=0;l<n.length-1;l++)c=nt(this,a[i+l],t,l),c===Qe&&(c=this._$AH[l]),o||=!At(c)||c!==this._$AH[l],c===g?e=g:e!==g&&(e+=(c??"")+n[l+1]),this._$AH[l]=c}o&&!s&&this.j(e)}j(e){e===g?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},cs=class extends ot{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===g?void 0:e}},ds=class extends ot{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==g)}},us=class extends ot{constructor(e,t,i,s,n){super(e,t,i,s,n),this.type=5}_$AI(e,t=this){if((e=nt(this,e,t,0)??g)===Qe)return;let i=this._$AH,s=e===g&&i!==g||e.capture!==i.capture||e.once!==i.once||e.passive!==i.passive,n=e!==g&&(i===g||s);s&&this.element.removeEventListener(this.name,this,i),n&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},ps=class{constructor(e,t,i){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(e){nt(this,e)}};var ya=fs.litHtmlPolyfillSupport;ya?.(qt,Tt),(fs.litHtmlVersions??=[]).push("3.2.1");var Rn=(r,e,t)=>{let i=t?.renderBefore??e,s=i._$litPart$;if(s===void 0){let n=t?.renderBefore??null;i._$litPart$=s=new Tt(e.insertBefore(Pt(),n),n,void 0,t??{})}return s._$AI(r),s};var x=class extends Fe{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=Rn(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return Qe}};x._$litElement$=!0,x.finalized=!0,globalThis.litElementHydrateSupport?.({LitElement:x});var va=globalThis.litElementPolyfillSupport;va?.({LitElement:x});(globalThis.litElementVersions??=[]).push("4.1.1");var D=r=>(e,t)=>{t!==void 0?t.addInitializer((()=>{customElements.define(r,e)})):customElements.define(r,e)};var xa={attribute:!0,type:String,converter:Ct,reflect:!1,hasChanged:ni},Sa=(r=xa,e,t)=>{let{kind:i,metadata:s}=t,n=globalThis.litPropertyMetadata.get(s);if(n===void 0&&globalThis.litPropertyMetadata.set(s,n=new Map),n.set(t.name,r),i==="accessor"){let{name:o}=t;return{set(a){let l=e.get.call(this);e.set.call(this,a),this.requestUpdate(o,l,r)},init(a){return a!==void 0&&this.P(o,void 0,r),a}}}if(i==="setter"){let{name:o}=t;return function(a){let l=this[o];e.call(this,a),this.requestUpdate(o,l,r)}}throw Error("Unsupported decorator location: "+i)};function h(r){return(e,t)=>typeof t=="object"?Sa(r,e,t):((i,s,n)=>{let o=s.hasOwnProperty(n);return s.constructor.createProperty(n,o?{...i,wrapped:!0}:i),o?Object.getOwnPropertyDescriptor(s,n):void 0})(r,e,t)}function b(r){return h({...r,state:!0,attribute:!1})}var Xe=(r,e,t)=>(t.configurable=!0,t.enumerable=!0,Reflect.decorate&&typeof e!="object"&&Object.defineProperty(r,e,t),t);function R(r,e){return(t,i,s)=>{let n=o=>o.renderRoot?.querySelector(r)??null;if(e){let{get:o,set:a}=typeof i=="object"?t:s??(()=>{let l=Symbol();return{get(){return this[l]},set(c){this[l]=c}}})();return Xe(t,i,{get(){let l=o.call(this);return l===void 0&&(l=n(this),(l!==null||this.hasUpdated)&&a.call(this,l)),l}})}return Xe(t,i,{get(){return n(this)}})}}function Ye(r,e,t){bs.set(r,{demod:e,config:t})}function at(){return[...bs.keys()]}function ai(r){let e=ws(r);return new e.config(r).mode}function _n(r,e,t,i){let s=ws(t);return new s.demod(r,e,t,i)}function T(r){let e=ws(r);return new e.config(r)}var le=class{base;constructor(e){this.base=e}get mode(){return typeof this.base=="string"&&(this.base=this.create(this.base)),this.base}set mode(e){this.base=e}hasStereo(){return!1}getStereo(){return!1}setStereo(e){return this}hasBandwidth(){return!1}setBandwidth(e){return this}hasSquelch(){return!1}getSquelch(){return 0}setSquelch(e){return this}},bs=new Map;function ws(r){let e=typeof r=="string"?r:r.scheme,t=bs.get(e);if(!t)throw`Scheme "${e}" was not registered.`;return t}var li=class r{static OUT_RATE=48e3;static TIME_BUFFER=.05;constructor(e){this.newAudioContext=e?.newAudioContext||(()=>new AudioContext),this.lastPlayedAt=-1,this.ac=void 0,this.gainNode=void 0,this.gain=0}newAudioContext;lastPlayedAt;ac;gainNode;gain;play(e,t){(this.ac===void 0||this.gainNode===void 0)&&(this.ac=this.newAudioContext(),this.gainNode=this.ac.createGain(),this.gainNode.gain.value=this.gain,this.gainNode.connect(this.ac.destination));let i=this.ac.createBuffer(2,e.length,r.OUT_RATE);i.getChannelData(0).set(e),i.getChannelData(1).set(t);let s=this.ac.createBufferSource();s.buffer=i,s.connect(this.gainNode),this.lastPlayedAt=Math.max(this.lastPlayedAt+e.length/r.OUT_RATE,this.ac.currentTime+r.TIME_BUFFER),s.start(this.lastPlayedAt)}setVolume(e){this.gain=e,this.gainNode!==void 0&&(this.gainNode.gain.value=e)}getVolume(){return this.gain}get sampleRate(){return this.ac?this.ac.sampleRate:48e3}};var hi=class extends EventTarget{constructor(e){super(),this.inRate=1024e3,this.player=e?.player||new li,this.squelchControl=new vs(this.player.sampleRate),this.modeOptions=e?.modeOptions||{},this.mode=ai("WBFM"),this.demod=this.getScheme(this.mode),this.frequencyOffset=0,this.latestStereo=!1}inRate;player;squelchControl;modeOptions;mode;demod;frequencyOffset;latestStereo;expectingFrequency;setMode(e){this.demod=this.getScheme(e,this.demod),this.mode=e}getMode(){return this.mode}setFrequencyOffset(e){this.frequencyOffset=e}getFrequencyOffset(){return this.frequencyOffset}expectFrequencyAndSetOffset(e,t){this.expectingFrequency={center:e,offset:t}}setVolume(e){this.player.setVolume(e)}getVolume(){return this.player.getVolume()}getScheme(e,t){return e.scheme==t?.getMode().scheme?(t.setMode(e),t):_n(this.inRate,this.player.sampleRate,e,this.modeOptions[e.scheme])}setSampleRate(e){this.inRate=e,this.demod=this.getScheme(this.mode,void 0)}receiveSamples(e){this.expectingFrequency?.center===e.frequency&&(this.frequencyOffset=this.expectingFrequency.offset,this.expectingFrequency=void 0);let{left:t,right:i,stereo:s,snr:n}=this.demod.demodulate(e.I,e.Q,this.frequencyOffset);this.squelchControl.applySquelch(this.mode,t,i,n),this.player.play(t,i),s!=this.latestStereo&&(this.dispatchEvent(new ys(s)),this.latestStereo=s)}addEventListener(e,t,i){super.addEventListener(e,t,i)}},ys=class extends CustomEvent{constructor(e){super("stereo-status",{detail:e,bubbles:!0,composed:!0})}},vs=class{sampleRate;constructor(e){this.sampleRate=e}countdown=0;applySquelch(e,t,i,s){let o=T(e);if(o.hasSquelch()){if(o.getSquelch()<s){this.countdown=.1*this.sampleRate;return}if(this.countdown>0){this.countdown-=t.length;return}t.fill(0),i.fill(0)}}};var xs=class{make;constructor(e,t,i){this.make=e,this.buffers=[...Array(t).keys()].map(()=>e(i||0)),this.current=0}buffers;current;get(e){let t=this.buffers[this.current];return t.length<e&&(t=this.make(e),this.buffers[this.current]=t),this.current=(this.current+1)%this.buffers.length,t.length==e?t:t.subarray(0,e)}};var B=class extends xs{constructor(e,t){super(i=>new Float32Array(i),e,t)}},de=class{constructor(e,t){this.pools=new B(e*2,t)}pools;get(e){return[this.pools.get(e),this.pools.get(e)]}},Ss=class{buffer;constructor(e){this.buffer=e,this.readPos=0,this.writePos=0,this.filled=0}readPos;writePos;filled;get capacity(){return this.buffer.length}get available(){return this.filled}clear(){this.readPos=0,this.writePos=0,this.filled=0}fill(e,t){if(t===void 0||t>=this.buffer.length){this.buffer.fill(e),this.readPos=0,this.writePos=0,this.filled=this.buffer.length;return}let i=t,s=this.writePos;for(;i>0;){let n=Math.min(i,this.buffer.length-this.writePos);this.buffer.subarray(s,s+n).fill(e),s=(s+n)%this.buffer.length,i-=n}this.writePos=s,this.filled=Math.min(this.buffer.length,this.filled+t),this.filled==this.buffer.length&&(this.readPos=this.writePos)}store(e){let t=Math.min(e.length,this.buffer.length),{dstOffset:i}=this.doCopy(t,e,e.length-t,this.buffer,this.writePos);this.writePos=i,this.filled=Math.min(this.buffer.length,this.filled+t),this.filled==this.buffer.length&&(this.readPos=this.writePos)}moveTo(e){let t=Math.min(e.length,this.buffer.length,this.filled);if(t==0)return 0;let{srcOffset:i}=this.doCopy(t,this.buffer,this.readPos,e,0);return this.readPos=i,this.filled-=t,t}consume(e){let t=Math.min(this.filled,e);this.readPos=(this.readPos+t)%this.buffer.length,this.filled-=t}copyTo(e){let t=Math.min(e.length,this.buffer.length),i=(this.writePos+this.buffer.length-t)%this.buffer.length;this.doCopy(t,this.buffer,i,e,0)}doCopy(e,t,i,s,n){for(;e>0;){let o=Math.min(e,t.length-i,s.length-n);s.set(t.subarray(i,i+o),n),i=(i+o)%t.length,n=(n+o)%s.length,e-=o}return{srcOffset:i,dstOffset:n}}},ve=class extends Ss{constructor(e){super(new Float32Array(e))}};function W(r,e,t,i){i===void 0&&(i=1),t+=(t+1)%2;let s=e/r,n=new Float32Array(t),o=Math.floor(t/2),a=0;for(let l=0;l<t;++l){let c;l==o?c=2*Math.PI*s:(c=Math.sin(2*Math.PI*s*(l-o))/(l-o),c*=.54-.46*Math.cos(2*Math.PI*l/(t-1))),a+=c,n[l]=c}a/=i;for(let l=0;l<t;++l)n[l]/=a;return n}function Dn(r){r+=(r+1)%2;let e=Math.floor(r/2),t=new Float32Array(r);for(let i=0;i<t.length;++i)i%2==0&&(t[i]=2/(Math.PI*(e-i)));return t}function Rs(r){let e=new Float32Array(r);for(let t=0;t<r;++t)e[t]=.42-.5*Math.cos(2*Math.PI*t/(r-1))+.08*Math.cos(4*Math.PI*t/(r-1));return e}function lt(r){if(r<4&&(r=4),(r-1&r)==0)return r;let e=1;for(;e<r;)e<<=1;return e}var ci=class r{length;static ofLength(e){return new r(lt(e))}constructor(e){this.length=e,this.revIndex=_a(e),this.coefs=Ra(e),this.copy=new de(4,e),this.out=new de(4,e),this.window=new Float32Array(e),this.window.fill(1)}revIndex;coefs;copy;out;window;setWindow(e){this.window.set(e)}transform(e,t){let i=this.length,[s,n]=this.out.get(i);if(s.fill(0),n.fill(0),t===void 0)for(let o=0;o<i&&o<e.length;++o){let a=this.revIndex[o];s[a]=this.window[o]*e[o]/i}else for(let o=0;o<i&&o<e.length&&o<t.length;++o){let a=this.revIndex[o];s[a]=this.window[o]*e[o]/i,n[a]=this.window[o]*t[o]/i}return $n(this.length,!1,this.coefs,s,n),[s,n]}transformCircularBuffers(e,t){let i=this.length,[s,n]=this.copy.get(i);return e.copyTo(s),t.copyTo(n),this.transform(s,n)}reverse(e,t){let i=this.length,[s,n]=this.out.get(i);s.fill(0),n.fill(0);for(let o=0;o<i&&o<e.length&&o<t.length;++o){let a=this.revIndex[o];s[a]=e[o],n[a]=t[o]}return $n(this.length,!0,this.coefs,s,n),[s,n]}};function $n(r,e,t,i,s){let n=e?-1:1;for(let o=0;o<r;o+=4){let a=o,l=o+1,c=o+2,d=o+3,u=i[a],m=i[l],f=i[c],$=i[d],q=s[a],Be=s[l],Ie=s[c],Ve=s[d];i[a]=u+m+f+$,i[l]=u-m-n*(Ve-Ie),i[c]=u+m-f-$,i[d]=u-m+n*(Ve-Ie),s[a]=q+Be+Ie+Ve,s[l]=q-Be-n*(f-$),s[c]=q+Be-Ie-Ve,s[d]=q-Be+n*(f-$)}for(let o=8,a=0;o<=r;o*=2,++a){let l=t[a],c=o/2;for(let d=0;d<r;d+=o)for(let u=0;u<c;u+=4){let m=l.real[u],f=l.imag[u]*n,$=l.real[u+1],q=l.imag[u+1]*n,Be=l.real[u+2],Ie=l.imag[u+2]*n,Ve=l.real[u+3],Tr=l.imag[u+3]*n,Rt=d+u,Xt=Rt+c,kr=i[Rt],Br=i[Xt],Ir=s[Rt],Nr=s[Xt],zr=m*Br-f*Nr,Or=m*Nr+f*Br;i[Rt]=kr+zr,i[Xt]=kr-zr,s[Rt]=Ir+Or,s[Xt]=Ir-Or;let _t=d+u+1,Yt=_t+c,Lr=i[_t],Ur=i[Yt],Wr=s[_t],Hr=s[Yt],jr=$*Ur-q*Hr,Vr=$*Hr+q*Ur;i[_t]=Lr+jr,i[Yt]=Lr-jr,s[_t]=Wr+Vr,s[Yt]=Wr-Vr;let Dt=d+u+2,Jt=Dt+c,Gr=i[Dt],Zr=i[Jt],Kr=s[Dt],Qr=s[Jt],Xr=Be*Zr-Ie*Qr,Yr=Be*Qr+Ie*Zr;i[Dt]=Gr+Xr,i[Jt]=Gr-Xr,s[Dt]=Kr+Yr,s[Jt]=Kr-Yr;let $t=d+u+3,ei=$t+c,Jr=i[$t],en=i[ei],tn=s[$t],sn=s[ei],rn=Ve*en-Tr*sn,nn=Ve*sn+Tr*en;i[$t]=Jr+rn,i[ei]=Jr-rn,s[$t]=tn+nn,s[ei]=tn-nn}}}function Ra(r){let e=Fn(r),t=[];for(let i=0,s=4;i<e;++i,s*=2){t.push({real:new Float32Array(s),imag:new Float32Array(s)});for(let n=0;n<s;++n){let o=-1*Math.PI*n/s;t[i].real[n]=Math.cos(o),t[i].imag[n]=Math.sin(o)}}return t}function _a(r){let e=Fn(r),t=new Int32Array(r);for(let i=0;i<r;++i)t[i]=Da(i,e);return t}function Fn(r){let e=0;for(let t=r-1;t>0;t>>=1)++e;return e}function Da(r,e){let t=0;for(let i=0;i<e;++i)t<<=1,t|=r&1,r>>=1;return t}var _s=null,Fa=!1,kt;function ze(){return Fa?null:_s}function Ds(){let r=ze();return{active:r!==null,simd:r!==null&&r.wrx_simd()===1,error:kt}}function Ma(r){let e=r.exports;return typeof e.wrx_version!="function"||e.wrx_version()!==1?(kt="DSP module ABI mismatch",!1):(_s=e,kt=void 0,!0)}async function Mn(r){if(_s)return!0;try{if(typeof WebAssembly!="object")throw new Error("WebAssembly unavailable");let e=fetch(r),t;if(typeof WebAssembly.instantiateStreaming=="function")try{t=await WebAssembly.instantiateStreaming(e,{})}catch{let s=await(await fetch(r)).arrayBuffer();t=await WebAssembly.instantiate(s,{})}else{let i=await(await e).arrayBuffer();t=await WebAssembly.instantiate(i,{})}return Ma(t.instance)}catch(e){return kt=e instanceof Error?e.message:String(e),console.warn("WASM DSP unavailable, using JavaScript DSP:",kt),!1}}function ue(r,e,t){return new Float32Array(r.memory.buffer,e,t)}var Bt=class{constructor(e){this.ex=e;this.ptr=0;this.bytes=0}get(e){if(e>this.bytes){this.bytes>0&&this.ex.wrx_free(this.ptr,this.bytes);let t=Math.max(e,Math.ceil(this.bytes*1.5),4096);this.ptr=this.ex.wrx_alloc(t),this.bytes=t}return this.ptr}free(){this.bytes>0&&this.ex.wrx_free(this.ptr,this.bytes),this.ptr=0,this.bytes=0}};function ne(r,e,t,i){let s=ue(r,e,i);if(t instanceof Float32Array)s.set(i===t.length?t:t.subarray(0,i));else for(let n=0;n<i;++n)s[n]=t[n]}var ht=typeof FinalizationRegistry=="function"?new FinalizationRegistry(r=>{try{r()}catch{}}):null;var $s=class{constructor(e,t){this.ex=e;this.length=t;let i=e.fft_new(t);this.handle=i,this.out=new de(4,t),ht?.register(this,()=>e.fft_free(i))}ex;length;handle;out;setWindow(e){let t=Math.min(e.length,this.length);ue(this.ex,this.ex.fft_window_ptr(this.handle),this.length).set(e.subarray(0,t))}collect(){let[e,t]=this.out.get(this.length);return e.set(ue(this.ex,this.ex.fft_out_re_ptr(this.handle),this.length)),t.set(ue(this.ex,this.ex.fft_out_im_ptr(this.handle),this.length)),[e,t]}transform(e,t){let i=this.ex,s=Math.min(this.length,e.length);return t!==void 0&&(s=Math.min(s,t.length)),ne(i,i.fft_in_re_ptr(this.handle),e,s),t!==void 0&&ne(i,i.fft_in_im_ptr(this.handle),t,s),i.fft_forward(this.handle,s,t!==void 0?1:0),this.collect()}transformCircularBuffers(e,t){let i=this.ex;return e.copyTo(ue(i,i.fft_in_re_ptr(this.handle),this.length)),t.copyTo(ue(i,i.fft_in_im_ptr(this.handle),this.length)),i.fft_forward(this.handle,this.length,1),this.collect()}reverse(e,t){let i=this.ex,s=Math.min(this.length,e.length,t.length);return ne(i,i.fft_in_re_ptr(this.handle),e,s),ne(i,i.fft_in_im_ptr(this.handle),t,s),i.fft_reverse(this.handle,s),this.collect()}},Oe=class{static ofLength(e){let t=ze();return t?new $s(t,lt(e)):ci.ofLength(e)}};function di(r,e){if(e==0&&r==0)return 0;let t=Math.abs(e)<Math.abs(r),i=t?e/r:r/e,s=i*i,n=i*(.9999993329+s*(-.3332985605+s*(.1994653599+s*(-.1390853351+s*(.0964200441+s*(-.0559098861+s*(.0218612288+s*-.004054058)))))));return t&&(i>=0?n=Math.PI/2-n:n=-Math.PI/2-n),e>=0?n:r>=0?n+Math.PI:n-Math.PI}var ui=class r{coefs;constructor(e){this.coefs=e,this.offset=this.coefs.length-1,this.center=Math.floor(this.coefs.length/2),this.pool=new B(2,2*this.offset),this.curSamples=this.pool.get(this.offset)}offset;center;pool;curSamples;setCoefficients(e){let t=this.curSamples;this.coefs=e,this.offset=this.coefs.length-1,this.center=Math.floor(this.coefs.length/2),this.curSamples=this.pool.get(this.offset),this.loadSamples(t)}clone(){return new r(this.coefs)}getDelay(){return this.center}inPlace(e){this.loadSamples(e);for(let t=0;t<e.length;++t)e[t]=this.get(t)}loadSamples(e){let t=e.length+this.offset;if(this.curSamples.length!=t){let i=this.pool.get(t);i.set(this.curSamples.subarray(this.curSamples.length-this.offset)),this.curSamples=i}else this.curSamples.copyWithin(0,e.length);this.curSamples.set(e,this.offset)}get(e){let t=0,i=0,s=this.coefs.length,n=4*Math.floor(s/4);for(;t<n;)i+=this.coefs[t++]*this.curSamples[e++]+this.coefs[t++]*this.curSamples[e++]+this.coefs[t++]*this.curSamples[e++]+this.coefs[t++]*this.curSamples[e++];let o=2*Math.floor(s/2);for(;t<o;)i+=this.coefs[t++]*this.curSamples[e++]+this.coefs[t++]*this.curSamples[e++];for(;t<s;)i+=this.coefs[t++]*this.curSamples[e++];return i}},ee=class r{constructor(e){this.fft=Oe.ofLength(e.length*2),this.kernel=this.computeKernel(e),this.overlap=e.length-1,this.input=new ve(this.fft.length),this.input.fill(0,this.overlap),this.work=new Float32Array(this.fft.length),this.output=new ve((this.fft.length-this.overlap)*2),this.output.fill(0,this.fft.length-this.overlap)}fft;kernel;overlap;input;work;output;computeKernel(e){let t=new Float32Array(this.fft.length),i=new Float32Array(this.fft.length);t.set(e),t.subarray(0,e.length).reverse();for(let n=0;n<t.length;++n)t[n]*=t.length;let s=this.fft.transform(t,i);return[new Float32Array(s[0]),new Float32Array(s[1])]}setCoefficients(e){let t=lt(e.length*2),i=e.length-1;if(this.kernel=this.computeKernel(e),t==this.fft.length&&i==this.overlap)return;this.fft=Oe.ofLength(t),this.overlap=i;let s=new Float32Array(this.input.available);this.input.moveTo(s),this.input=new ve(this.fft.length),i>s.length&&this.input.fill(0,i-s.length),this.input.store(s),this.work=new Float32Array(this.fft.length),this.output=new ve((this.fft.length-this.overlap)*2),this.output.fill(0,this.fft.length-this.overlap)}clone(){let e=new r(new Float32Array(this.overlap+1));return e.kernel=this.kernel,e}getDelay(){return this.fft.length-this.overlap/2}inPlace(e){let t=0,i=0;for(;e.length-t>0;){if(this.input.available<this.input.capacity){let s=Math.min(e.length-t,this.input.capacity-this.input.available);this.input.store(e.subarray(t,t+s)),t+=s}if(this.input.available==this.input.capacity){this.input.copyTo(this.work),this.input.consume(this.input.capacity-this.overlap);let s=this.fft.transform(this.work);for(let o=0;o<s[0].length;++o){let a=s[0][o],l=s[1][o],c=this.kernel[0][o],d=this.kernel[1][o];s[0][o]=a*c-l*d,s[1][o]=l*c+a*d}let n=this.fft.reverse(s[0],s[1]);this.output.store(n[0].subarray(this.overlap))}if(i<e.length){let s=this.output.moveTo(e.subarray(i,t));i+=s}}}},xe=class r{constructor(e){this.filterI=e.clone(),this.filterQ=e.clone()}filterI;filterQ;setCoefficients(e){this.filterI.setCoefficients(e),this.filterQ.setCoefficients(e)}clone(){return new r(this.filterI)}getDelay(){return this.filterI.getDelay()}inPlace(e,t){this.filterI.inPlace(e),this.filterQ.inPlace(t)}},pi=class r{constructor(e){this.buffer=new Float32Array(e),this.ptr=0}buffer;ptr;clone(){return new r(this.getDelay())}getDelay(){return this.buffer.length}inPlace(e){for(let t=0;t<e.length;++t){let i=e[t];e[t]=this.buffer[this.ptr],this.buffer[this.ptr]=i,this.ptr=(this.ptr+1)%this.buffer.length}}},ct=class r{sampleRate;constructor(e,t,i){this.sampleRate=e,this.dcBlocker=new Fs(e),this.alpha=Nt(e,t),this.counter=0,this.maxPower=0,this.maxGain=i||100}dcBlocker;alpha;counter;maxPower;maxGain;clone(){let e=new r(this.sampleRate,1,this.maxGain);return e.alpha=this.alpha,e}getDelay(){return 0}inPlace(e){let t=this.alpha,i=this.maxPower,s=this.counter,n;this.dcBlocker.inPlace(e);for(let o=0;o<e.length;++o){let a=e[o],l=a*a;l>.9*i?(s=this.sampleRate,l>i&&(i=l)):s>0?--s:i-=t*i,n=Math.min(this.maxGain,1/Math.sqrt(i)),e[o]*=n}this.maxPower=i,this.counter=s}},Fs=class r{constructor(e){this.alpha=Nt(e,.5),this.dc=0}alpha;dc;clone(){let e=new r(1e3);return e.alpha=this.alpha,e.dc=this.dc,e}getDelay(){return 0}inPlace(e){let t=this.alpha,i=this.dc;for(let s=0;s<e.length;++s)i+=t*(e[s]-i),e[s]-=i;this.dc=i}};function Nt(r,e){return 1-Math.exp(-1/(r*e))}var Ms=class r{sampleRate;constructor(e,t,i,s){this.sampleRate=e,this.q=[t,i,s],this.v=[0,0]}q;v;clone(){return new r(this.sampleRate,...this.q)}getDelay(){return 0}inPlace(e){let t=this.q,i=this.v[0],s=this.v[1];for(let n=0;n<e.length;++n){let o=e[n];e[n]=s=t[0]*o+t[1]*i+t[2]*s,i=o}this.v[0]=i,this.v[1]=s}},Cs=class r{sampleRate;constructor(e,t,i,s,n,o){this.sampleRate=e,this.q=[t,i,s,n,o],this.v=[0,0,0,0]}q;v;clone(){return new r(this.sampleRate,...this.q)}getDelay(){return 0}inPlace(e){let t=this.q,i=this.v[0],s=this.v[1],n=this.v[2],o=this.v[3];for(let a=0;a<e.length;++a){let l=e[a],c=e[a]=t[0]*l+t[1]*i+t[2]*s+t[3]*n+t[4]*o;o=n,n=c,s=i,i=l}this.v[0]=i,this.v[1]=s,this.v[2]=n,this.v[3]=o}};function Ca(r,e){let t=2*Math.PI*e/r,s=1/(2*r*Math.tan(t/2)),n=1+2*s*r,o=1-2*s*r;return[1/n,1/n,-o/n]}function Ea(r,e,t){let i=2*Math.PI*e/r,s=Math.sin(i)/(2*t),n=(1-Math.cos(i))/2,o=1-Math.cos(i),a=(1-Math.cos(i))/2,l=1+s,c=-2*Math.cos(i),d=1-s;return[n/l,o/l,a/l,-c/l,-d/l]}var It=class extends Ms{constructor(e,t){super(e,...Ca(e,1/(2*Math.PI*t)))}};var Es=class extends Cs{constructor(e,t,i){super(e,...Ea(e,t,i))}},X=class{sampleRate;constructor(e){this.sampleRate=e,this.cosine=1,this.sine=0}cosine;sine;inPlace(e,t,i){let s=this.cosine,n=this.sine,o=Math.cos(2*Math.PI*i/this.sampleRate),a=Math.sin(2*Math.PI*i/this.sampleRate);for(let l=0;l<e.length;++l){let c=e[l]*s-t[l]*n;t[l]=e[l]*n+t[l]*s,e[l]=c;let d=s*a+n*o;s=s*o-n*a,n=d}this.cosine=s,this.sine=n}},fi=class{sampleRate;targetFreq;constructor(e,t,i){this.sampleRate=e,this.targetFreq=t,this.iqPool=new de(2),this.downShifter=new X(e),this.upShifter=new X(e),this.filterI=new Es(e,i*100,1),this.filterQ=this.filterI.clone(),this.prev=[1,0],this.tolerance=2*Math.PI*i/e,this.speedEstimate=0,this.speedDecay=Nt(e,.25),this.isLocked=!1}iqPool;downShifter;upShifter;filterI;filterQ;prev;tolerance;speedEstimate;speedDecay;isLocked;get locked(){return this.isLocked}extract(e){let t=this.speedDecay,i=this.prev[0],s=this.prev[1],n=this.speedEstimate,o=this.iqPool.get(e.length),a=o[0],l=o[1];a.set(e),l.fill(0),this.downShifter.inPlace(a,l,-this.targetFreq),this.filterI.inPlace(a),this.filterQ.inPlace(l);for(let c=0;c<a.length;++c){let d=Math.hypot(a[c],l[c]);d>0?(a[c]/=d,l[c]/=d,n+=t*(di(l[c]*i-a[c]*s,a[c]*i+l[c]*s)-n)):n+=t*(2*this.tolerance-n),i=a[c],s=l[c]}return this.upShifter.inPlace(a,l,this.targetFreq),this.prev[0]=i,this.prev[1]=s,this.speedEstimate=n,this.isLocked=n>=-this.tolerance&&n<=this.tolerance,o}};var Cn=null,En=null,Pn=null;function An(r){Cn!==r&&(Cn=r,En=new Bt(r),Pn=new Bt(r))}function Le(r,e){return An(r),En.get(e)}function qn(r,e){return An(r),Pn.get(e)}var Ps=class{constructor(e,t){this.ex=e;this.coefs=t;let i=Le(e,t.length*4);ne(e,i,t,t.length);let s=e.fir_new(i,t.length);this.handle=s,ht?.register(this,()=>e.fir_free(s))}ex;coefs;handle;setCoefficients(e){this.coefs=e;let t=Le(this.ex,e.length*4);ne(this.ex,t,e,e.length),this.ex.fir_set_coefs(this.handle,t,e.length)}clone(){return new Z(this.coefs)}getDelay(){return Math.floor(this.coefs.length/2)}inPlace(e){let t=e.length;if(t===0)return;let i=Le(this.ex,t*4);ne(this.ex,i,e,t),this.ex.fir_in_place(this.handle,i,t),e.set(ue(this.ex,i,t))}loadSamples(e){let t=e.length,i=Le(this.ex,Math.max(4,t*4));ne(this.ex,i,e,t),this.ex.fir_load(this.handle,i,t)}get(e){return this.ex.fir_get(this.handle,e)}},Z=class extends ui{constructor(e){let t=ze();if(t)return new Ps(t,e);super(e)}};var Me;(function(r){r[r.Upper=0]="Upper",r[r.Lower=1]="Lower"})(Me||(Me={}));var mi=class{constructor(e,t,i){let s=Dn(t);this.filterHilbert=i?.useFftFilter?new ee(s):new Z(s),this.filterDelay=new pi(this.filterHilbert.getDelay()),this.hilbertMul=e==Me.Upper?-1:1}filterHilbert;filterDelay;hilbertMul;setSideband(e){this.hilbertMul=e==Me.Upper?-1:1}demodulate(e,t,i){this.filterDelay.inPlace(e),this.filterHilbert.inPlace(t);for(let s=0;s<i.length;++s)i[s]=(e[s]+t[s]*this.hilbertMul)/2}},gi=class{constructor(e){this.alpha=Nt(e,.5),this.carrierAmplitude=0}alpha;carrierAmplitude;demodulate(e,t,i){let s=this.alpha,n=this.carrierAmplitude;for(let o=0;o<i.length;++o){let a=e[o],l=t[o],c=a*a+l*l,d=Math.sqrt(c);n+=s*(d-n),i[o]=n==0?0:d/n-1}this.carrierAmplitude=n}},dt=class{constructor(e){this.mul=1/(2*Math.PI*e),this.lI=0,this.lQ=0}mul;lI;lQ;setMaxDeviation(e){this.mul=1/(2*Math.PI*e)}demodulate(e,t,i){let s=this.mul,n=this.lI,o=this.lQ;for(let a=0;a<e.length;++a){let l=n*e[a]+o*t[a],c=n*t[a]-e[a]*o;n=e[a],o=t[a],i[a]=di(c,l)*s}this.lI=n,this.lQ=o}},bi=class{constructor(e,t){this.pool=new B(4),this.detector=new fi(e,t,2)}pool;detector;separate(e){let t=this.pool.get(e.length),i=this.detector.extract(e),s=i[0],n=i[1];for(let o=0;o<e.length;++o)t[o]=e[o]*s[o]*n[o]*4;return{found:this.detector.locked,diff:t}}};function Y(r,e){let t=0;for(let i=0;i<r.length;++i){let s=r[i],n=e[i];t+=s*s+n*n}return t/r.length}var As=class{ratio;constructor(e,t){this.ratio=e,this.filter=t.clone(),this.pool=new B(2)}filter;pool;downsample(e){let t=this.ratio,i=Math.floor(e.length/t),s=this.pool.get(i);this.filter.loadSamples(e);for(let n=0;n<i;++n)s[n]=this.filter.get(Math.floor(n*t));return s}getDelay(){return this.filter.getDelay()}};function qs(r,e,t){let i=r/e,s=t;return typeof s=="number"&&(s=W(r,e/2,s)),new As(i,new Z(s))}var wi=class{constructor(e,t,i){this.downsampler=qs(e,t,i)}downsampler;downsample(e){return this.downsampler.downsample(e)}getDelay(){return this.downsampler.getDelay()}},yi=class{constructor(e,t,i){this.downsamplerI=qs(e,t,i),this.downsamplerQ=qs(e,t,i)}downsamplerI;downsamplerQ;downsample(e,t){return[this.downsamplerI.downsample(e),this.downsamplerQ.downsample(t)]}getDelay(){return this.downsamplerI.getDelay()}};var zt=class{constructor(e,t,i){this.ex=e;this.ratio=t;let s=Le(e,i.length*4);ne(e,s,i,i.length);let n=e.fir_new(s,i.length);this.handle=n,this.delay=Math.floor(i.length/2),ht?.register(this,()=>e.fir_free(n))}ex;ratio;handle;pool=new B(2);delay;downsample(e){let t=this.ex,i=e.length,s=Math.floor(i/this.ratio),n=this.pool.get(s),o=Le(t,Math.max(4,i*4)),a=qn(t,Math.max(4,s*4));ne(t,o,e,i);let l=t.fir_downsample(this.handle,o,i,this.ratio,a,s);return n.set(ue(t,a,l)),n}getDelay(){return this.delay}};function Tn(r,e,t){return typeof t=="number"?W(r,e/2,t):t}var Ot=class extends wi{wasm;constructor(e,t,i){let s=ze();if(!s){super(e,t,i);return}super(e,t,new Float32Array(1)),this.wasm=new zt(s,e/t,Tn(e,t,i))}downsample(e){return this.wasm?this.wasm.downsample(e):super.downsample(e)}getDelay(){return this.wasm?this.wasm.getDelay():super.getDelay()}},he=class extends yi{wasmI;wasmQ;constructor(e,t,i){let s=ze();if(!s){super(e,t,i);return}super(e,t,new Float32Array(1));let n=Tn(e,t,i);this.wasmI=new zt(s,e/t,n),this.wasmQ=new zt(s,e/t,n)}downsample(e,t){return this.wasmI&&this.wasmQ?[this.wasmI.downsample(e),this.wasmQ.downsample(t)]:super.downsample(e,t)}getDelay(){return this.wasmI?this.wasmI.getDelay():super.getDelay()}};var vi=class{outRate;mode;constructor(e,t,i,s){this.outRate=t,this.mode=i;let n=s?.downsamplerTaps||151;this.rfTaps=s?.rfTaps||151,this.shifter=new X(e),this.downsampler=new he(e,t,n);let o=W(t,this.mode.bandwidth/2,this.rfTaps);this.filter=new xe(s?.useFftFilter?new ee(o):new Z(o)),this.demodulator=new gi(t),this.outPool=new B(1)}rfTaps;shifter;downsampler;filter;demodulator;outPool;getMode(){return this.mode}setMode(e){this.mode=e;let t=W(this.outRate,e.bandwidth/2,this.rfTaps);this.filter.setCoefficients(t)}demodulate(e,t,i){this.shifter.inPlace(e,t,-i);let[s,n]=this.downsampler.downsample(e,t),o=Y(s,n);this.filter.inPlace(s,n);let a=Y(s,n)*this.outRate/this.mode.bandwidth;this.demodulator.demodulate(s,n,s);let l=this.outPool.get(s.length);return l.set(s),{left:s,right:l,stereo:!1,snr:a/o}}},xi=class extends le{constructor(e){super(e)}create(){return{scheme:"AM",bandwidth:15e3,squelch:0}}hasBandwidth(){return!0}getBandwidth(){return this.mode.bandwidth}setBandwidth(e){return this.mode={...this.mode,bandwidth:Math.max(250,Math.min(e,3e4))},this}hasSquelch(){return!0}getSquelch(){return this.mode.squelch}setSquelch(e){return this.mode={...this.mode,squelch:Math.max(0,Math.min(e,6))},this}};var Si=class{outRate;mode;constructor(e,t,i,s){this.outRate=t,this.mode=i;let n=s?.downsamplerTaps||151;this.audioTaps=s?.audioTaps||351;let o=s?.toneFrequency||600;this.shifter=new X(e),this.downsampler=new he(e,t,n);let a=W(t,i.bandwidth/2,this.audioTaps);this.filter=new xe(s?.useFftFilter?new ee(a):new Z(a)),this.toneShifter=new X(t),this.toneFrequency=o,this.agc=new ct(t,10),this.outPool=new B(1)}audioTaps;shifter;downsampler;filter;toneShifter;toneFrequency;agc;outPool;getMode(){return this.mode}setMode(e){this.mode=e;let t=W(this.outRate,e.bandwidth/2,this.audioTaps);this.filter.setCoefficients(t)}demodulate(e,t,i){this.shifter.inPlace(e,t,-i);let[s,n]=this.downsampler.downsample(e,t),o=Y(s,n);this.filter.inPlace(s,n);let a=Y(s,n)*this.outRate/this.mode.bandwidth;this.toneShifter.inPlace(s,n,this.toneFrequency),this.agc.inPlace(s);let l=this.outPool.get(s.length);return l.set(s),{left:s,right:l,stereo:!1,snr:a/o}}},Ri=class extends le{constructor(e){super(e)}create(){return{scheme:"CW",bandwidth:50}}hasBandwidth(){return!0}getBandwidth(){return this.mode.bandwidth}setBandwidth(e){return this.mode={...this.mode,bandwidth:Math.max(5,Math.min(e,1e3))},this}};var _i=class{outRate;mode;constructor(e,t,i,s){this.outRate=t,this.mode=i;let n=s?.downsamplerTaps||151;this.rfTaps=s?.rfTaps||151,this.shifter=new X(e),this.downsampler=new he(e,t,n);let o=W(t,i.maxF,this.rfTaps);this.filter=new xe(s?.useFftFilter?new ee(o):new Z(o)),this.demodulator=new dt(i.maxF/t),this.outPool=new B(1)}rfTaps;shifter;downsampler;filter;demodulator;outPool;getMode(){return this.mode}setMode(e){this.mode=e;let t=W(this.outRate,e.maxF,this.rfTaps);this.filter.setCoefficients(t),this.demodulator.setMaxDeviation(e.maxF/this.outRate)}demodulate(e,t,i){this.shifter.inPlace(e,t,-i);let[s,n]=this.downsampler.downsample(e,t),o=Y(s,n);this.filter.inPlace(s,n);let a=Y(s,n)*this.outRate/(this.mode.maxF*2);this.demodulator.demodulate(s,n,s);let l=this.outPool.get(s.length);return l.set(s),{left:s,right:l,stereo:!1,snr:a/o}}},Di=class extends le{constructor(e){super(e)}create(){return{scheme:"NBFM",maxF:5e3,squelch:0}}hasBandwidth(){return!0}getBandwidth(){return 2*this.mode.maxF}setBandwidth(e){return this.mode={...this.mode,maxF:Math.max(125,Math.min(e/2,15e3))},this}hasSquelch(){return!0}getSquelch(){return this.mode.squelch}setSquelch(e){return this.mode={...this.mode,squelch:Math.max(0,Math.min(e,6))},this}};var Lt=class{outRate;mode;constructor(e,t,i,s){this.outRate=t,this.mode=i;let n=s?.downsamplerTaps||151;this.rfTaps=s?.rfTaps||151;let o=s?.hilbertTaps||151;this.shifter=new X(e),this.downsampler=new he(e,t,n);let a=W(this.outRate,i.bandwidth/2,this.rfTaps);this.filter=s?.useFftFilter?new ee(a):new Z(a),this.demodulator=new mi(i.scheme=="USB"?Me.Upper:Me.Lower,o,{useFftFilter:s?.useFftFilter}),this.agc=new ct(t,3),this.outPool=new B(1)}rfTaps;shifter;downsampler;filter;demodulator;agc;outPool;getMode(){return this.mode}setMode(e){this.mode=e;let t=W(this.outRate,e.bandwidth/2,this.rfTaps);this.filter.setCoefficients(t),this.demodulator.setSideband(e.scheme=="USB"?Me.Upper:Me.Lower)}demodulate(e,t,i){this.shifter.inPlace(e,t,-i);let[s,n]=this.downsampler.downsample(e,t),o=Y(s,n);this.demodulator.demodulate(s,n,s),this.filter.inPlace(s);let a=Y(s,s)*this.outRate/(this.mode.bandwidth*2);this.agc.inPlace(s);let l=this.outPool.get(s.length);return l.set(s),{left:s,right:l,stereo:!1,snr:a/o}}},Ut=class extends le{constructor(e){super(e)}create(e){return{scheme:e,bandwidth:2800,squelch:0}}hasBandwidth(){return!0}getBandwidth(){return this.mode.bandwidth}setBandwidth(e){return this.mode={...this.mode,bandwidth:Math.max(10,Math.min(e,15e3))},this}hasSquelch(){return!0}getSquelch(){return this.mode.squelch}setSquelch(e){return this.mode={...this.mode,squelch:Math.max(0,Math.min(e,6))},this}};var $i=class{mode;constructor(e,t,i,s){this.mode=i;let n=Math.min(e,336e3);this.stage1=new Ts(e,n,i,s),this.stage2=new ks(n,t,i,s)}stage1;stage2;getMode(){return this.mode}setMode(e){this.mode=e,this.stage1.setMode(e),this.stage2.setMode(e)}demodulate(e,t,i){let s=this.stage1.demodulate(e,t,i),n=this.stage2.demodulate(s.left);return n.snr=s.snr,n}},Ts=class{outRate;mode;constructor(e,t,i,s){this.outRate=t,this.mode=i;let n=75e3,o=s?.downsamplerTaps||151,a=s?.rfTaps||151;this.shifter=new X(e),e!=t&&(this.downsampler=new he(e,t,o));let l=W(t,n,a);this.filter=new xe(s?.useFftFilter?new ee(l):new Z(l)),this.demodulator=new dt(n/t)}shifter;downsampler;filter;demodulator;getMode(){return this.mode}setMode(e){this.mode=e}demodulate(e,t,i){this.shifter.inPlace(e,t,-i);let[s,n]=this.downsampler?this.downsampler.downsample(e,t):[e,t],o=Y(s,n);this.filter.inPlace(s,n);let a=Y(s,n)*this.outRate/15e4;return this.demodulator.demodulate(s,n,s),{left:s,right:new Float32Array(s),stereo:!1,snr:a/o}}},ks=class{mode;constructor(e,t,i,s){this.mode=i;let n=19e3,o=(s?.deemphasizerTc===void 0?50:s.deemphasizerTc)/1e6,a=s?.audioTaps||41,l=Math.min(15e3,t/2),c=W(e,l,a,1/.9);this.monoSampler=new Ot(e,t,c),this.stereoSampler=new Ot(e,t,c),this.stereoSeparator=new bi(e,n),this.leftDeemph=new It(t,o),this.rightDeemph=new It(t,o),this.outPool=new B(2,1024)}monoSampler;stereoSampler;stereoSeparator;leftDeemph;rightDeemph;outPool;getMode(){return this.mode}setMode(e){this.mode=e}demodulate(e){let t=this.monoSampler.downsample(e);if(this.mode.stereo){let s=this.stereoSeparator.separate(e);if(s.found){let n=this.stereoSampler.downsample(s.diff),o=this.outPool.get(t.length),a=t;for(let l=0;l<n.length;++l)o[l]=t[l]-n[l],a[l]=t[l]+n[l];return this.leftDeemph.inPlace(o),this.rightDeemph.inPlace(a),{left:o,right:a,stereo:!0,snr:1}}}this.leftDeemph.inPlace(t);let i=this.outPool.get(t.length);return i.set(t),{left:t,right:i,stereo:!1,snr:1}}},Fi=class extends le{constructor(e){super(e)}create(){return{scheme:"WBFM",stereo:!0}}hasStereo(){return!0}getStereo(){return this.mode.stereo}setStereo(e){return this.mode={...this.mode,stereo:e},this}getBandwidth(){return 15e4}};Ye("WBFM",$i,Fi);Ye("NBFM",_i,Di);Ye("AM",vi,xi);Ye("USB",Lt,Ut);Ye("LSB",Lt,Ut);Ye("CW",Si,Ri);var Mi=class extends EventTarget{clicksPerSecond;constructor(e){super(),this.clicksPerSecond=e,this.sampleRate=1024e3,this.samplesPerClick=this.getSamplesPerClick(),this.countedSamples=0}sampleRate;samplesPerClick;countedSamples;getSamplesPerClick(){return this.clicksPerSecond===void 0?void 0:Math.floor(this.sampleRate/this.clicksPerSecond)}setSampleRate(e){this.sampleRate=e,this.samplesPerClick=this.getSamplesPerClick()}receiveSamples(e){this.countedSamples+=e.I.length,!(this.samplesPerClick===void 0||this.samplesPerClick>this.countedSamples)&&(this.countedSamples%=this.samplesPerClick,this.dispatchEvent(new Bs))}addEventListener(e,t,i){super.addEventListener(e,t,i)}},Bs=class extends Event{constructor(){super("sample-click")}};var Ci=class{constructor(e){e===void 0?e=2048:e=Math.max(32,Math.min(131072,e)),this.I=new ve(131072),this.Q=new ve(131072),this.fft=Oe.ofLength(e),this.fft.setWindow(Rs(this.fft.length)),this.lastOutput=new Float32Array(this.fft.length),this.dirty=!0}I;Q;lastFrequency;fft;lastOutput;dirty;set size(e){this.fft=Oe.ofLength(e),this.fft.setWindow(Rs(this.fft.length)),this.lastOutput=new Float32Array(this.fft.length),this.dirty=!0}get size(){return this.fft.length}setSampleRate(e){}receiveSamples(e){this.I.store(e.I),this.Q.store(e.Q),this.lastFrequency=e.frequency,this.dirty=!0}frequency(){return this.lastFrequency}getSpectrum(e){if(this.dirty){let t=this.fft.transformCircularBuffers(this.I,this.Q);this.lastOutput.fill(-1/0);for(let i=0;i<this.lastOutput.length;++i)this.lastOutput[i]=20*Math.log10(Math.hypot(t[0][i],t[1][i]));this.dirty=!1}e.set(this.lastOutput.subarray(0,e.length))}};var F=class extends Error{constructor(e,t,i){super(e,i!==void 0?i:typeof t=="object"?t:void 0),typeof t=="number"&&(this.type=t,this.name=`RadioError.${_[t]}`)}type},_;(function(r){r[r.NoUsbSupport=0]="NoUsbSupport",r[r.NoDeviceSelected=1]="NoDeviceSelected",r[r.UnsupportedDevice=2]="UnsupportedDevice",r[r.UsbTransferError=3]="UsbTransferError",r[r.TunerError=4]="TunerError"})(_||(_={}));var Ei=class extends Error{constructor(e,t,i){super(e,i!==void 0?i:typeof t=="object"?t:void 0),typeof t=="number"&&(this.type=t,this.name=`RadioError.${Wt[t]}`)}type},Wt;(function(r){r[r.TransferError=0]="TransferError",r[r.DemodulationError=1]="DemodulationError"})(Wt||(Wt={}));var Pi=class{constructor(){this.promise=Promise.resolve()}promise;async run(e){return this.promise=this.promise.then(()=>e()),this.promise}};var Ce=class extends CustomEvent{constructor(e){super("radio",{detail:e})}},Se;(function(r){r[r.OFF=0]="OFF",r[r.PLAYING=1]="PLAYING"})(Se||(Se={}));var Ai=class extends EventTarget{sourceProvider;sampleReceiver;options;constructor(e,t,i){super(),this.sourceProvider=e,this.sampleReceiver=t,this.options=i,this.sampleRate=1024e3,this.state=Se.OFF,this.frequency=885e5,this.parameterValues=new Map,this.singleThread=new Pi}sampleRate;state;frequency;parameterValues;singleThread;transfers;source;async start(){return this.singleThread.run(async()=>{if(this.state==Se.OFF)try{this.source=await this.sourceProvider.get(),this.sampleRate=await this.source.setSampleRate(this.sampleRate),this.frequency=await this.source.setCenterFrequency(this.frequency);for(let[e,t]of this.parameterValues.entries())await this.source.setParameter(e,t);await this.source.startReceiving(),this.transfers=new Is(this.source,this.sampleReceiver,this,this.sampleRate,this.options),this.transfers.startStream(),this.state=Se.PLAYING,this.dispatchEvent(new Ce({type:"started"}))}catch(e){this.dispatchEvent(new Ce({type:"error",exception:e}))}})}async stop(){return this.singleThread.run(async()=>{if(this.state==Se.PLAYING)try{await this.transfers.stopStream(),await this.source.close(),this.state=Se.OFF,this.dispatchEvent(new Ce({type:"stopped"}))}catch(e){this.dispatchEvent(new Ce({type:"error",exception:e}))}})}isPlaying(){return this.state!=Se.OFF}async setFrequency(e){return this.singleThread.run(async()=>{if(this.state==Se.OFF)this.frequency=e;else if(this.frequency!=e)try{this.frequency=await this.source.setCenterFrequency(e)}catch(t){this.dispatchEvent(new Ce({type:"error",exception:t}))}})}getFrequency(){return this.frequency}async setSampleRate(e){this.sampleRate=e}getSampleRate(){return this.sampleRate}async setParameter(e,t){return this.singleThread.run(async()=>{if(this.state==Se.OFF)this.parameterValues.set(e,t);else try{this.parameterValues.set(e,await this.source.setParameter(e,t))}catch(i){this.dispatchEvent(new Ce({type:"error",exception:i}))}})}getParameter(e){return this.parameterValues.get(e)}onReceiveSamples(e){}addEventListener(e,t,i){super.addEventListener(e,t,i)}},Is=class r{source;sampleReceiver;radio;sampleRate;static DEFAULT_BUFS_PER_SEC=20;constructor(e,t,i,s,n){this.source=e,this.sampleReceiver=t,this.radio=i,this.sampleRate=s;let o=n?.buffersPerSecond;(o===void 0||o<=0)&&(o=r.DEFAULT_BUFS_PER_SEC),this.samplesPerBuf=512*Math.ceil(s/o/512),this.buffersWanted=0,this.buffersRunning=0,this.stopCallback=r.nilCallback}samplesPerBuf;buffersWanted;buffersRunning;stopCallback;static PARALLEL_BUFFERS=2;async startStream(){for(this.sampleReceiver.setSampleRate(this.sampleRate),await this.source.startReceiving(),this.buffersWanted=r.PARALLEL_BUFFERS;this.buffersRunning<this.buffersWanted;)++this.buffersRunning,this.readStream()}async stopStream(){if(this.buffersRunning==0&&this.buffersWanted==0)return;let e=new Promise(t=>{this.stopCallback=t});return this.buffersWanted=0,e}async readStream(){try{for(;this.buffersRunning<=this.buffersWanted;){let e=await this.source.readSamples(this.samplesPerBuf);this.radio.onReceiveSamples(e),this.sampleReceiver.receiveSamples(e)}}catch(e){let t=new Ei("Sample transfer was interrupted. Did you unplug your device?",Wt.TransferError,{cause:e}),i=new Ce({type:"error",exception:t});this.radio.dispatchEvent(i)}--this.buffersRunning,this.buffersRunning==0&&(this.stopCallback(),this.stopCallback=r.nilCallback)}static nilCallback(){}};var qi=class r{receivers;static of(e,...t){let i=[];e instanceof r?i.push(...e.receivers):i.push(e);for(let s of t)s instanceof r?i.push(...s.receivers):i.push(s);return i.length==1?i[0]:new r(i)}constructor(e){this.receivers=e}setSampleRate(e){for(let t of this.receivers)t.setSampleRate(e)}receiveSamples(e){for(let t of this.receivers)t.receiveSamples(e)}};var j;(function(r){r[r.Off=0]="Off",r[r.I=1]="I",r[r.Q=2]="Q"})(j||(j={}));var Ns=class extends CustomEvent{constructor(e){super("radio",{detail:e})}},Ti=class extends Ai{constructor(e,t,i){super(e,t,i),this.directSampling=!1,this.setFrequencyCorrection(0),this.setGain(null),this.setFrequency(885e5),this.setDirectSamplingMethod(j.Off),this.enableBiasTee(!1)}directSampling;async setFrequencyCorrection(e){return this.setParameter("frequency_correction",e)}getFrequencyCorrection(){return this.getParameter("frequency_correction")}async setGain(e){return this.setParameter("gain",e)}getGain(){return this.getParameter("gain")}async setDirectSamplingMethod(e){return this.setParameter("direct_sampling_method",e)}getDirectSamplingMethod(){return this.getParameter("direct_sampling_method")}async enableBiasTee(e){return this.setParameter("bias_tee",e)}isBiasTeeEnabled(){return this.getParameter("bias_tee")}onReceiveSamples(e){let t=e.data?.directSampling||!1;t!=this.directSampling&&(this.directSampling=t,this.dispatchEvent(new Ns({type:"directSampling",active:this.directSampling})))}addEventListener(e,t,i){super.addEventListener(e,t,i)}};var ki=class{constructor(e){this.pool=new de(4,e)}pool;convert(e){let t=new Uint8Array(e),i=t.length/2,s=this.pool.get(i),n=s[0],o=s[1];for(let a=0;a<i;++a)n[a]=t[2*a]/128-.995,o[a]=t[2*a+1]/128-.995;return s}};var Bi=[[0,8,2,223],[50,8,2,190],[55,8,2,139],[60,8,2,123],[65,8,2,105],[70,8,2,88],[75,0,2,68],[90,0,2,52],[110,0,2,36],[140,0,2,20],[180,0,2,19],[250,0,2,17],[280,0,2,0],[310,0,65,0],[588,0,64,0]],Ue=class r{com;i2c;muxCfgs;vcoPowerRef;static XTAL_FREQ=288e5;static REGISTERS=[131,50,117,192,64,214,108,245,99,117,104,108,131,128,0,15,0,192,48,72,204,96,0,84,174,74,192];static BIT_REVS=[0,8,4,12,2,10,6,14,1,9,5,13,3,11,7,15];static IF_FREQ=357e4;xtalFreq;hasPllLock;shadowRegs;static async check(e,t){await e.openI2C();let i=!1;try{i=await e.getI2CReg(t,0)==105}catch{}return await e.closeI2C(),i}constructor(e,t,i,s){this.com=e,this.i2c=t,this.muxCfgs=i,this.vcoPowerRef=s,this.xtalFreq=r.XTAL_FREQ,this.hasPllLock=!1,this.shadowRegs=new Uint8Array}async setFrequency(e){return await this._setMux(e+r.IF_FREQ),await this._setPll(e+r.IF_FREQ)-r.IF_FREQ}async open(){await this.com.setDemodReg(1,177,26,1),await this.com.setDemodReg(0,8,77,1),await this.com.setDemodReg(1,21,1,1),await this.com.openI2C(),this.shadowRegs=new Uint8Array(r.REGISTERS);for(let e=0;e<this.shadowRegs.length;++e)await this.com.setI2CReg(this.i2c,e+5,this.shadowRegs[e]);await this._initElectronics(),await this.com.closeI2C()}async close(){await this._writeRegMask(6,177,255),await this._writeRegMask(5,179,255),await this._writeRegMask(7,58,255),await this._writeRegMask(8,64,255),await this._writeRegMask(9,192,255),await this._writeRegMask(10,58,255),await this._writeRegMask(12,53,255),await this._writeRegMask(15,104,255),await this._writeRegMask(17,3,255),await this._writeRegMask(23,244,255),await this._writeRegMask(25,12,255)}async setAutoGain(){await this._writeRegMask(5,0,16),await this._writeRegMask(7,16,16),await this._writeRegMask(12,11,159)}async setManualGain(e){let t=Math.floor(e/3.5),i=e-3.5*t>=2.3?1:0;t<0&&(t=0),t>15&&(t=15),t==15&&(i=0);let s=t+i,n=t;await this._writeRegMask(5,16,16),await this._writeRegMask(7,0,16),await this._writeRegMask(12,8,159),await this._writeRegMask(5,s,15),await this._writeRegMask(7,n,15)}setXtalFrequency(e){this.xtalFreq=e}getIntermediateFrequency(){return r.IF_FREQ}getMinimumFrequency(){return r.XTAL_FREQ}async _calibrateFilter(){let e=!0;for(;;){if(await this._writeRegMask(11,96,96),await this._writeRegMask(15,4,4),await this._writeRegMask(16,0,3),await this._setPll(56e6),!this.hasPllLock)throw new F("PLL not locked -- cannot tune to the selected frequency.",_.TunerError);await this._writeRegMask(11,16,16),await this._writeRegMask(11,0,16),await this._writeRegMask(15,0,4);let t=await this._readRegBuffer(0,5),s=new Uint8Array(t)[4]&15;if(s==15&&(s=0),s==0||!e)return s;e=!1}}async _setMux(e){let t=e/1e6,i;for(i=0;i<this.muxCfgs.length-1&&!(t<this.muxCfgs[i+1][0]);++i);let s=this.muxCfgs[i];await this._writeRegMask(23,s[1],8),await this._writeRegMask(26,s[2],195),await this._writeRegMask(27,s[3],255),await this._writeRegMask(16,0,11),await this._writeRegMask(8,0,63),await this._writeRegMask(9,0,63)}async _setPll(e){let t=Math.floor(this.xtalFreq);await this._writeRegMask(16,0,16),await this._writeRegMask(26,0,12),await this._writeRegMask(18,128,224);let i=Math.min(6,Math.floor(Math.log(177e7/e)/Math.LN2)),s=1<<i+1,n=await this._readRegBuffer(0,5),a=(new Uint8Array(n)[4]&48)>>4;a>this.vcoPowerRef?--i:a<this.vcoPowerRef&&++i,await this._writeRegMask(16,i<<5,224);let l=e*s,c=Math.floor(l/(2*t)),d=l%(2*t);if(c>63)return this.hasPllLock=!1,0;let u=Math.floor((c-13)/4),m=(c-13)%4;await this._writeRegMask(20,u+(m<<6),255),await this._writeRegMask(18,d==0?8:0,8);let f=Math.min(65535,Math.floor(32768*d/t));return await this._writeRegMask(22,f>>8,255),await this._writeRegMask(21,f&255,255),await this._getPllLock(),await this._writeRegMask(26,8,8),2*t*(c+f/65536)/s}async _getPllLock(){let e=!0;for(;;){let t=await this._readRegBuffer(0,3);if(new Uint8Array(t)[2]&64){this.hasPllLock=!0;return}if(!e){this.hasPllLock=!0;return}await this._writeRegMask(18,96,224),e=!1}}async _initElectronics(){await this._writeRegMask(12,0,15),await this._writeRegMask(19,49,63),await this._writeRegMask(29,0,56);let e=await this._calibrateFilter();await this._writeRegMask(10,16|e,31),await this._writeRegMask(11,107,239),await this._writeRegMask(7,0,128),await this._writeRegMask(6,16,48),await this._writeRegMask(30,64,96),await this._writeRegMask(5,0,128),await this._writeRegMask(31,0,128),await this._writeRegMask(15,0,128),await this._writeRegMask(25,96,96),await this._writeRegMask(29,229,199),await this._writeRegMask(28,36,248),await this._writeRegMask(13,83,255),await this._writeRegMask(14,117,255),await this._writeRegMask(5,0,96),await this._writeRegMask(6,0,8),await this._writeRegMask(17,56,8),await this._writeRegMask(23,48,48),await this._writeRegMask(10,64,96),await this._writeRegMask(29,0,56),await this._writeRegMask(28,0,4),await this._writeRegMask(6,0,64),await this._writeRegMask(26,48,48),await this._writeRegMask(29,24,56),await this._writeRegMask(28,36,4),await this._writeRegMask(30,13,31),await this._writeRegMask(26,32,48)}async _readRegBuffer(e,t){let i=await this.com.getI2CRegBuffer(this.i2c,e,t),s=new Uint8Array(i);for(let n=0;n<s.length;++n){let o=s[n];s[n]=r.BIT_REVS[o&15]<<4|r.BIT_REVS[o>>4]}return s.buffer}async _writeRegMask(e,t,i){let n=this.shadowRegs[e-5]&~i|t&i;this.shadowRegs[e-5]=n,await this.com.setI2CReg(this.i2c,e,n)}};var Ii=class r extends Ue{static async maybeInit(e){if(!await Ue.check(e,52))return null;let i=new r(e);return await i.open(),i}constructor(e){super(e,52,Bi,2)}};var Ni=class r extends Ue{isRtlSdrBlogV4;input;static async maybeInit(e){if(!Ue.check(e,116))return null;let{manufacturer:i,model:s}=e.getBranding(),n=i=="RTLSDRBlog"&&s=="Blog V4",o=new r(e,n);return await o.open(),o}constructor(e,t){super(e,116,t?qa:Bi,1),this.isRtlSdrBlogV4=t,this.input=0}async setFrequency(e){let t=0;this.isRtlSdrBlogV4&&e<288e5&&(t=288e5);let i=await super.setFrequency(e+t);if(this.isRtlSdrBlogV4){let s=e<=288e5?2:e<25e7?1:0;this.input!=s&&(this.input=s,s==0?(await this._writeRegMask(6,0,8),await this._writeRegMask(5,0,96)):s==1?(await this._writeRegMask(6,0,8),await this._writeRegMask(5,96,96)):(await this._writeRegMask(6,8,8),await this._writeRegMask(5,32,96)),await this.com.setGpioOutput(5),await this.com.setGpioBit(5,s==2?0:1))}else{let s=e>345e6?0:1;this.input!=s&&(this.input=s,await this._writeRegMask(5,s==0?0:96,96))}return i-t}getMinimumFrequency(){return this.isRtlSdrBlogV4?0:super.getMinimumFrequency()}},qa=[[0,0,2,223],[2.2,8,2,223],[50,8,2,190],[55,8,2,139],[60,8,2,123],[65,8,2,105],[70,8,2,88],[75,8,2,68],[85,0,2,68],[90,0,2,52],[110,0,2,36],[112,8,2,36],[140,8,2,20],[172,0,2,20],[180,0,2,19],[242,8,2,19],[250,8,2,17],[280,8,2,0],[310,8,65,0],[588,8,64,0]];var zi=class r{constructor(e){this.device=e}device;static WRITE_FLAG=16;async claimInterface(){try{await this.device.claimInterface(0)}catch(e){throw new F("Could not connect to the RTL-SDR stick. Are you using it in another application?",_.UsbTransferError,{cause:e})}}async releaseInterface(){await this.device.releaseInterface(0)}getBranding(){return{manufacturer:this.device.manufacturerName,model:this.device.productName}}async setUsbReg(e,t,i){await this._setReg(256,e,t,i)}async setSysReg(e,t){await this._setReg(512,e,t,1)}async getSysReg(e){return this._getReg(512,e,1)}async setDemodReg(e,t,i,s){return await this._setRegBuffer(e,t<<8|32,this._numberToBuffer(i,s,!0)),this._getReg(10,288,1)}async getI2CReg(e,t){return await this._setRegBuffer(1536,e,new Uint8Array([t]).buffer),this._getReg(1536,e,1)}async setI2CReg(e,t,i){await this._setRegBuffer(1536,e,new Uint8Array([t,i]).buffer)}async getI2CRegBuffer(e,t,i){return await this._setRegBuffer(1536,e,new Uint8Array([t]).buffer),this._getRegBuffer(1536,e,i)}async setGpioOutput(e){e=1<<e;let t=await this.getSysReg(12292);await this.setSysReg(12292,t&~e),t=await this.getSysReg(12291),await this.setSysReg(12291,t|e)}async setGpioBit(e,t){e=1<<e;let i=await this.getSysReg(12289);i=t?i|e:i&~e,await this.setSysReg(12289,i)}async getSamples(e){let t=await this.device.transferIn(1,e);if(t.status=="ok")return t.data.buffer;if(t.status=="stall")return await this.device.clearHalt("in",1),new ArrayBuffer(e);throw new F(`USB bulk read failed length 0x${e.toString(16)} status=${t.status}`,_.UsbTransferError)}async openI2C(){await this.setDemodReg(1,1,24,1)}async closeI2C(){await this.setDemodReg(1,1,16,1)}async close(){await this.device.close()}async _setReg(e,t,i,s){try{await this._writeCtrlMsg(t,e|r.WRITE_FLAG,this._numberToBuffer(i,s))}catch(n){throw new F(`setReg failed block=0x${e.toString(16)} reg=${t.toString(16)} value=${i.toString(16)} length=${s}`,_.UsbTransferError,{cause:n})}}async _getReg(e,t,i){try{return this._bufferToNumber(await this._readCtrlMsg(t,e,i))}catch(s){throw new F(`getReg failed block=0x${e.toString(16)} reg=${t.toString(16)} length=${i}`,_.UsbTransferError,{cause:s})}}async _setRegBuffer(e,t,i){try{await this._writeCtrlMsg(t,e|r.WRITE_FLAG,i)}catch(s){throw new F(`setRegBuffer failed block=0x${e.toString(16)} reg=${t.toString(16)}`,_.UsbTransferError,{cause:s})}}async _getRegBuffer(e,t,i){try{return this._readCtrlMsg(t,e,i)}catch(s){throw new F(`getRegBuffer failed block=0x${e.toString(16)} reg=${t.toString(16)} length=${i}`,_.UsbTransferError,{cause:s})}}_bufferToNumber(e){let t=e.byteLength,i=new DataView(e);if(t==0)return 0;if(t==1)return i.getUint8(0);if(t==2)return i.getUint16(0,!0);if(t==4)return i.getUint32(0,!0);throw new F(`Cannot parse ${t}-byte number`,_.UsbTransferError)}_numberToBuffer(e,t,i){let s=new ArrayBuffer(t),n=new DataView(s);if(t==1)n.setUint8(0,e);else if(t==2)n.setUint16(0,e,!i);else if(t==4)n.setUint32(0,e,!i);else throw new F(`Cannot write ${t}-byte number`,_.UsbTransferError);return s}async _readCtrlMsg(e,t,i){let s={requestType:"vendor",recipient:"device",request:0,value:e,index:t},n=await this.device.controlTransferIn(s,Math.max(8,i));if(n.status=="ok")return n.data.buffer.slice(0,i);throw new F(`USB read failed value=0x${e.toString(16)} index=0x${t.toString(16)} status=${n.status}`,_.UsbTransferError)}async _writeCtrlMsg(e,t,i){let s={requestType:"vendor",recipient:"device",request:0,value:e,index:t},n=await this.device.controlTransferOut(s,i);if(n.status!="ok")throw new F(`USB write failed value=0x${e.toString(16)} index=0x${t.toString(16)} status=${n.status}`,_.UsbTransferError)}};var Ta=[{vendorId:3034,productId:10290},{vendorId:3034,productId:10296}],Oi=class{constructor(e){this.webusb=e?.webusb||navigator.usb,this.device=void 0}webusb;device;async get(){return this.device===void 0&&(this.device=await this.getDevice()),await this.device.open(),Ht.open(this.device)}async getDevice(){if(this.webusb===void 0)throw new F("This browser does not support the WebUSB API",_.NoUsbSupport);try{return this.webusb.requestDevice({filters:Ta})}catch(e){throw new F("No device was selected",_.NoDeviceSelected,{cause:e})}}},Ht=class r{com;tuner;static XTAL_FREQ=288e5;static BYTES_PER_SAMPLE=2;constructor(e,t){this.com=e,this.tuner=t,this.centerFrequency=0,this.ppm=0,this.gain=null,this.directSamplingMethod=j.Off,this.directSampling=j.Off,this.biasTeeEnabled=!1}centerFrequency;ppm;gain;directSamplingMethod;directSampling;biasTeeEnabled;static async open(e){let t=new zi(e);await t.claimInterface(),await r._init(t);let i=await r._findTuner(t),s=new r(t,i);return await s.setGain(s.gain),await s.setFrequencyCorrection(s.ppm),s}static async _init(e){await e.setUsbReg(8192,9,1),await e.setUsbReg(8536,512,2),await e.setUsbReg(8520,528,2),await e.setSysReg(12299,34),await e.setSysReg(12288,232),await e.setDemodReg(1,1,20,1),await e.setDemodReg(1,1,16,1),await e.setDemodReg(1,21,0,1),await e.setDemodReg(1,22,0,1),await e.setDemodReg(1,23,0,1),await e.setDemodReg(1,24,0,1),await e.setDemodReg(1,25,0,1),await e.setDemodReg(1,26,0,1),await e.setDemodReg(1,27,0,1),await e.setDemodReg(1,28,202,1),await e.setDemodReg(1,29,220,1),await e.setDemodReg(1,30,215,1),await e.setDemodReg(1,31,216,1),await e.setDemodReg(1,32,224,1),await e.setDemodReg(1,33,242,1),await e.setDemodReg(1,34,14,1),await e.setDemodReg(1,35,53,1),await e.setDemodReg(1,36,6,1),await e.setDemodReg(1,37,80,1),await e.setDemodReg(1,38,156,1),await e.setDemodReg(1,39,13,1),await e.setDemodReg(1,40,113,1),await e.setDemodReg(1,41,17,1),await e.setDemodReg(1,42,20,1),await e.setDemodReg(1,43,113,1),await e.setDemodReg(1,44,116,1),await e.setDemodReg(1,45,25,1),await e.setDemodReg(1,46,65,1),await e.setDemodReg(1,47,165,1),await e.setDemodReg(0,25,5,1),await e.setDemodReg(1,147,240,1),await e.setDemodReg(1,148,15,1),await e.setDemodReg(1,17,0,1),await e.setDemodReg(1,4,0,1),await e.setDemodReg(0,97,96,1),await e.setDemodReg(0,6,128,1),await e.setDemodReg(1,177,27,1),await e.setDemodReg(0,13,131,1)}static async _findTuner(e){let t=await Ii.maybeInit(e);if(t===null&&(t=await Ni.maybeInit(e)),t===null)throw await e.releaseInterface(),new F("Sorry, your USB dongle has an unsupported tuner chip.",_.UnsupportedDevice);return t}async setSampleRate(e){let t=Math.floor(this._getXtalFrequency()*4194304/e);t&=268435452;let i=Math.floor(this._getXtalFrequency()*(1<<22)/t);return await this.com.setDemodReg(1,159,t>>16&65535,2),await this.com.setDemodReg(1,161,t&65535,2),await this._resetDemodulator(),i}async setFrequencyCorrection(e){this.ppm=e;let t=-1*Math.floor(this.ppm*(1<<24)/1e6);await this.com.setDemodReg(1,62,t>>8&63,1),await this.com.setDemodReg(1,63,t&255,1);let i=this._getXtalFrequency();this.tuner.setXtalFrequency(i);let s=this.tuner.getIntermediateFrequency();s!=0&&await this._setIfFrequency(s),this.centerFrequency!=0&&await this.setCenterFrequency(this.centerFrequency)}async _setIfFrequency(e){let t=this._getXtalFrequency(),i=-1*Math.floor(e*(1<<22)/t);return await this.com.setDemodReg(1,25,i>>16&63,1),await this.com.setDemodReg(1,26,i>>8&255,1),await this.com.setDemodReg(1,27,i&255,1),Math.floor(-1*i*t/(1<<22))}getFrequencyCorrection(){return this.ppm}async setGain(e){this.gain=e,await this.com.openI2C(),this.directSampling?this._enableRtlAgc(e==null):this.gain===null?await this.tuner.setAutoGain():await this.tuner.setManualGain(this.gain),await this.com.closeI2C()}getGain(){return this.gain}async enableBiasTee(e){this.biasTeeEnabled=e,await this.com.setGpioOutput(0),await this.com.setGpioBit(0,e?1:0)}isBiasTeeEnabled(){return this.biasTeeEnabled}async _enableRtlAgc(e){await this.com.setDemodReg(0,25,e?37:5,1)}_getXtalFrequency(){return Math.floor(r.XTAL_FREQ*(1+this.ppm/1e6))}async _resetDemodulator(){await this.com.setDemodReg(1,1,20,1),await this.com.setDemodReg(1,1,16,1)}async setCenterFrequency(e){await this._maybeSetDirectSampling(e);let t;return this.directSampling?t=this._setIfFrequency(e):(await this.com.openI2C(),t=await this.tuner.setFrequency(e),await this.com.closeI2C()),this.centerFrequency=e,t}async setDirectSamplingMethod(e){this.directSamplingMethod!=e&&(this.directSamplingMethod=e,this.centerFrequency!=0&&await this.setCenterFrequency(this.centerFrequency))}getDirectSamplingMethod(){return this.directSamplingMethod}async _maybeSetDirectSampling(e){let i=e<this.tuner.getMinimumFrequency()?this.directSamplingMethod:j.Off;if(this.directSampling==i)return;let s=this.directSampling==j.Off,n=i!=j.Off;if(this.directSampling=i,n){s&&(await this.com.openI2C(),await this.tuner.close(),await this.com.closeI2C()),await this.com.setDemodReg(1,177,26,1),await this.com.setDemodReg(1,21,0,1);let o=i==j.I?128:144;await this.com.setDemodReg(0,6,o,1),await this._enableRtlAgc(!0)}else{await this.com.openI2C(),await this.tuner.open(),await this.com.closeI2C();let o=this.tuner.getIntermediateFrequency();o!=0&&await this._setIfFrequency(o),await this.com.setDemodReg(1,21,1,1),await this.com.setDemodReg(0,6,128,1),await this._enableRtlAgc(!1),await this.setGain(this.getGain())}}async resetBuffer(){await this.com.setUsbReg(8520,528,2),await this.com.setUsbReg(8520,0,2)}async readSamples(e){let t=await this.com.getSamples(e*r.BYTES_PER_SAMPLE),i=this.centerFrequency,s=this.directSampling!=j.Off;return{frequency:i,directSampling:s,data:t}}async close(){await this.com.openI2C(),await this.tuner.close(),await this.com.closeI2C(),await this.com.releaseInterface(),await this.com.close()}};var zs=class{rtl;constructor(e){this.rtl=e,this.converter=new ki}converter;setSampleRate(e){return this.rtl.setSampleRate(e)}setCenterFrequency(e){return this.rtl.setCenterFrequency(e)}setParameter(e,t){switch(e){case"bias_tee":return this.rtl.enableBiasTee(t);case"direct_sampling_method":return this.rtl.setDirectSamplingMethod(t);case"frequency_correction":return this.rtl.setFrequencyCorrection(t);case"gain":return this.rtl.setGain(t)}}startReceiving(){return this.rtl.resetBuffer()}async readSamples(e){let t=await this.rtl.readSamples(e),i=this.converter.convert(t.data);return{I:i[0],Q:i[1],frequency:t.frequency,data:{directSampling:t.directSampling}}}close(){return this.rtl.close()}},Li=class{constructor(e){this.provider=e||new Oi}provider;async get(){return new zs(await this.provider.get())}};function kn(){let r=localStorage.getItem("config"),e=Bn();return r!=null&&(e=In(e,JSON.parse(r))),new Os(e)}var Os=class{constructor(e){this.cfg={...Bn,...e}}save(){localStorage.setItem("config",JSON.stringify(this.cfg)),clearTimeout(this.timeout)}get(){return{...this.cfg.v1}}update(e){e(this.cfg.v1),this.scheduleSave()}scheduleSave(){clearTimeout(this.timeout),this.timeout=window.setTimeout(()=>this.save())}};function Bn(){return{v1:{modes:{WBFM:{scheme:"WBFM",stereo:!0},NBFM:{scheme:"NBFM",maxF:5e3,squelch:0},AM:{scheme:"AM",bandwidth:15e3,squelch:0},LSB:{scheme:"LSB",bandwidth:2800,squelch:0},USB:{scheme:"USB",bandwidth:2800,squelch:0},CW:{scheme:"CW",bandwidth:50}},mode:"WBFM",centerFrequency:885e5,tunedFrequency:885e5,tuningStep:1e3,frequencyScale:1e3,gain:null,sampleRate:1024e3,ppm:0,fftSize:2048,fmDeemph:50,biasTee:!1,lowFrequencyMethod:{name:"directSampling",channel:"Q",frequency:1e8,biasTee:!1},performanceTradeoff:"cpu",device:"auto",hackrfAmp:!1,wasmDsp:!0,minDecibels:-90,maxDecibels:-20,presets:{sortColumn:"frequency",list:[]},windows:{controls:{},settings:{},presets:{}}}}}function In(r,e){let t=s=>s&&typeof s=="object"&&!Array.isArray(s);if(!t(r)||!t(e))return e;let i={...r};for(let s in e)i[s]=In(i[s],e[s]);return i}var V=class{constructor(e,t=4){this.handler=e;this.minPixelDelta=t;this.onPointerMove=i=>this.drag(i),this.onPointerUp=i=>this.finish(i),this.onPointerCancel=i=>this.cancel(i)}startDragging(e){e.button==0&&(this.dragData&&(this.handler.cancelDrag(),this.dragData.release()),this.dragData=new Ls(e,this.minPixelDelta,this.onPointerMove,this.onPointerUp,this.onPointerCancel),this.dragData.capture(),this.drag(e),e.preventDefault())}drag(e){if(this.dragData===void 0)return;e.preventDefault();let{start:t,moved:i,x:s,y:n}=this.dragData.delta(e);i&&(t&&this.handler.startDrag(),this.handler.drag(s,n))}finish(e){this.dragData!==void 0&&(this.dragData.hasMoved()?(this.handler.finishDrag(),e.preventDefault()):this.handler.onClick(e),this.release())}cancel(e){this.dragData!==void 0&&(this.handler.cancelDrag(),e.preventDefault(),this.release())}release(){this.dragData?.release(),this.dragData=void 0}},Ls=class{constructor(e,t,i,s,n){this.minPixelDelta=t;this.move=i;this.up=s;this.cancel=n;this.moved=!1,this.startX=e.clientX,this.startY=e.clientY,this.pointerId=e.pointerId,this.target=e.target}capture(){this.target.addEventListener("pointermove",this.move),this.target.addEventListener("pointerup",this.up),this.target.addEventListener("pointercancel",this.cancel),this.target.setPointerCapture(this.pointerId)}release(){this.target.removeEventListener("pointermove",this.move),this.target.removeEventListener("pointerup",this.up),this.target.removeEventListener("pointercancel",this.cancel),this.target.releasePointerCapture(this.pointerId)}hasMoved(){return this.moved}delta(e){let t=!1;!this.moved&&this.minPixelDelta==0&&(t=!0,this.moved=!0);let i={start:t,moved:this.moved,x:e.clientX-this.startX,y:e.clientY-this.startY};return i.moved||Math.max(Math.abs(i.x),Math.abs(i.y))>=this.minPixelDelta&&(this.moved=!0,i.moved=!0,i.start=!0),i}};function Q(r,e){return p`<svg version="1.1" width="16" height="16">
    <title>${r}</title>
    ${e}
  </svg>`}var Nn=Q("Close",U`<g><path d="M2 4v-2h2l4 4 4 -4h2v2l-4 4 4 4v2h-2l-4 -4 -4 4h-2v-2l4 -4z"></path></g>`),zn=Q("Resize",U`<g><path d="M2,2V8L4.25,5.75 10.25,11.75 8,14 14,14 14,8 11.75,10.25 5.75,4.25 8,2Z"></path></g>`),On=Q("Stop playing",U`<g><path d="M3 3v10h10V3z"></path></g>`),Ln=Q("Start playing",U`<g><path d="M3 2v12l10 -6z"></path></g>`),Un=Q("Settings",U`<g><path d="M5 1A4 4 0 0 0 3.7 1.2L6.5 4 6 6 4 6.5 1.2 3.7A4 4 0 0 0 1 5 4 4 0 0 0 5 9 4 4 0 0 0 6.6 8.6L12.5 14.5A1.4 1.4 0 0 0 13.6 15 1.4 1.4 0 0 0 15 13.6 1.4 1.4 0 0 0 14.5 12.5L8.6 6.6A4 4 0 0 0 9 5 4 4 0 0 0 5 1z"></path></g>`),Wn=Q("Help",U`<g>
    <path
      d="M8 1A5 4.5 0 0 0 3 5.5L3 6L5 6L5 5.5A3 2.5 0 0 1 8 3A3 2.5 0 0 1 11 5.5A3 2.5 0 0 1 8 8L7 8L7 9L7 10L7 12L9 12L9 10A5 4.5 0 0 0 13 5.5A5 4.5 0 0 0 8 1z"
    ></path>
    <circle cy="14" cx="8" r="1"></circle>
  </g>`),Hn=Q("Scroll left",U`<g><path d="m11 2v2l-4 4 4 4v2H9L3 8 9 2Z"></path></g>`),jn=Q("Scroll right",U`<g><path d="m5 2v2l4 4 -4 4v2h2L13 8 7 2Z"></path></g>`);function Vn(r,e){return Q(r,U`<g>
        <path
          d="M7 1A6 6 0 0 0 1 7A6 6 0 0 0 7 13A6 6 0 0 0 13 7A6 6 0 0 0 7 1zM7 3A4 4 0 0 1 11 7A4 4 0 0 1 7 11A4 4 0 0 1 3 7A4 4 0 0 1 7 3z"
        ></path>
        <path d="M14.5 13l-1.5 1.5 -4 -4 1.5 -1.5z"></path>
        ${e}
      </g>`)}var Gn=Vn("Zoom in",U`<path d="M4 6v2h2v2h2v-2h2v-2h-2v-2h-2v2Z"></path>`),Zn=Vn("Zoom out",U`<path d="M4 6v2h6v-2Z"></path>`),Kn=Q("Stereo",U`<g><path d="M6 3A5 5 0 0 0 1 8A5 5 0 0 0 6 13A5 5 0 0 0 8 13A5 5 0 0 0 10 13A5 5 0 0 0 15 8A5 5 0 0 0 10 3A5 5 0 0 0 8 3A5 5 0 0 0 6 3zM6 5A3 3 0 0 1 9 8A3 3 0 0 1 6 11A3 3 0 0 1 3 8A3 3 0 0 1 6 5zM10 5A3 3 0 0 1 13 8A3 3 0 0 1 10 11A3 3 0 0 1 10 11A5 5 0 0 0 11 8A5 5 0 0 0 10 5z"></g>`),Qn=Q("Reload",U`<g>
    <path d="M8 1A7 7 0 0 0 1 8A7 7 0 0 0 15 8h-2A5 5 0 0 1 3 8A5 5 0 0 1 12 5h-3v2h6v-6h-2v2A7 7 0 0 0 8 1z"></path>
  </g>`),Us=Q("Add",U`<g><path d="M2,7h5v-5h2v5h5v2h-5v5h-2v-5h-5z"></path></g>`),Xn=Q("Edit",U`<g><path d="M1.9,15.37A1,1 0 0 1 0.63,14.1L2,10 12,0 16,4 6,14ZM2,14 5,13 3,11ZM6,12 14,4 12,2 4,10Z"></path></g>`),Yn=Q("Delete",U`<g><path d="M2 2h1l5 5 5 -5h1v1l-5 5 5 5v1h-1l-5 -5 -5 5h-1v-1l5 -5l-5 -5z"></path></g>`),Bd=Q("Update",U`<g><path d="M1 1L3 3A7 7 0 0 0 1 8A7 7 0 0 0 8 15v-2A5 5 0 0 1 3 8A5 5 0 0 1 4.5 4.5L7 7v-6h-6zM8 1v2A5 5 0 0 1 13 8A5 5 0 0 1 11.5 11.5L9 9v6h6L13 13A7 7 0 0 0 15 8A7 7 0 0 0 8 1z"></path></g>`),Jn=Q("Presets",U`<g><path d="M1,1h6v6h-6zM3,3v2h2v-2zM9,1h6v6h-6zM11,3v2h2v-2zM1,9h6v6h-6zM3,11v2h2v-2zM9,9h6v6h-6zM11,11v2h2v-2z"></path></g>`),eo=p`<svg version="1.1" width="10" height="9">
  <g><path d="M1,8h8l-4,-6z"></path></g>
</svg>`,to=p`<svg version="1.1" width="10" height="9">
  <g><path d="M1,1h8l-4,6z"></path></g>
</svg>`;var te=S`
  :host {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    accent-color: #2563eb;
  }

  input,
  select,
  button {
    font: inherit;
  }

  select,
  input[type="number"],
  input[type="text"] {
    border: 1px solid #94a3b8;
    border-radius: 6px;
    padding: 2px 6px;
    background: #fff;
    color: inherit;
  }

  button {
    border: 1px solid #94a3b8;
    border-radius: 6px;
    background: #f1f5f9;
    color: inherit;
    cursor: pointer;
    padding: 2px 8px;
  }

  button:hover:not(:disabled) {
    filter: brightness(0.96);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: 1px;
  }

  @media (prefers-color-scheme: dark) {
    select,
    input,
    input[type="number"],
    input[type="text"] {
      background: #0b1220;
      color: #e2e8f0;
      border-color: #334155;
    }

    button {
      background: #1e293b;
      color: #e2e8f0;
      border-color: #334155;
    }

    button:hover:not(:disabled) {
      filter: brightness(1.15);
    }
  }

  rr-window {
    bottom: calc(1em + 24px);
    right: 1em;
  }

  @media (max-width: 778px) {
    rr-window {
      bottom: calc(1em + 48px);
    }
  }

  button:has(svg[width="16"][height="16"]) {
    padding-inline: 0;
    width: 24px;
    height: 24px;
  }

  button > svg[width="16"][height="16"] {
    display: block;
    width: 16px;
    height: 16px;
    margin: auto;
  }

  /* Bigger touch targets on phones and tablets. */
  @media (pointer: coarse) {
    select,
    input[type="number"],
    input[type="text"],
    button {
      min-height: 34px;
    }

    button:has(svg[width="16"][height="16"]) {
      width: 36px;
      height: 36px;
    }
  }
`;var ie=function(r,e,t,i){var s=arguments.length,n=s<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,t):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,e,t,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(e,t,n):o(e,t))||n);return s>3&&n&&Object.defineProperty(e,t,n),n},G=function(r,e){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,e)},io,N=class extends x{constructor(){super(...arguments),this.label="",this.resizeable=!1,this.closeable=!1,this.fixed=!1,this.closed=!1,this.modal=!1,this.moving=!1}set position(e){this.pendingPosition=e}get position(){return this.pendingPosition||this.getPosition()}set size(e){this.pendingSize=e}get size(){return this.pendingSize||this.getSize()}static get styles(){return[te,S`
        :host {
          position: absolute;
          width: auto;
          height: auto;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        :host(.inline) {
          position: initial;
          display: inline-block;
        }

        .label {
          display: flex;
          flex-direction: row;
          align-items: center;
          border: 2px solid var(--ips-border-color);
          border-bottom: none;
          border-radius: 10px 10px 0 0;
          padding: 3px 8px;
          background: var(--ips-label-bg-active);
          color: var(--ips-label-color);
          cursor: grab;
        }

        .label.modal {
          cursor: default;
        }

        :host(.inactive) .label {
          background: var(--ips-label-bg-idle);
        }

        .label.moving {
          cursor: grabbing;
        }

        .label-left,
        .label-middle,
        .label-right {
          display: inline-block;
        }

        .label-middle {
          flex: 1;
        }

        .label-left {
          margin-right: 8px;
        }

        .label-right {
          margin-left: 8px;
        }

        .content {
          position: relative;
          box-sizing: border-box;
          border: 2px solid var(--ips-border-color);
          border-radius: 0 0 10px 10px;
          padding: 1ex;
          background: var(--ips-background);
          color: var(--ips-color);
        }

        .contentView {
          width: 100%;
          height: 100%;
        }

        .content.resizeable {
          padding: 1ex max(1ex + 6px, 16px) max(1ex + 6px, 16px) 1ex;
          border-bottom-right-radius: 0;
        }

        .content.resizeable .contentView {
          overflow: auto;
        }

        .right-resizer {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 16px;
          width: 2px;
          border: solid var(--ips-background);
          border-width: 8px 4px 0 11px;
          background: var(--ips-border-color);
          cursor: ew-resize;
        }

        .bottom-resizer {
          position: absolute;
          left: 0;
          bottom: 0;
          right: 16px;
          height: 2px;
          border: solid var(--ips-background);
          border-width: 11px 0 4px 8px;
          border-bottom-left-radius: 10px;
          background: var(--ips-border-color);
          cursor: ns-resize;
        }

        .corner-resizer {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 16px;
          height: 16px;
          fill: var(--ips-border-color);
          cursor: nwse-resize;
        }

        .modalbg {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.5);
          z-index: -1;
        }

        :host {
          --ips-border-color: var(--rr-window-border-color, black);
          --ips-background: var(--rr-window-background, white);
          --ips-color: var(--rr-window-color, black);
          --ips-label-bg-idle: var(--rr-label-bg-idle, #53577f);
          --ips-label-bg-active: var(--rr-label-bg-active, #4f5fff);
          --ips-label-color: var(--rr-label-color, white);
        }

        @media (prefers-color-scheme: dark) {
          :host {
            --ips-border-color: var(--rr-window-border-color, #ddd);
            --ips-background: var(--rr-window-background, black);
            --ips-color: var(--rr-window-color, #ddd);
            --ips-label-bg-idle: var(--rr-label-bg-idle, #53577f);
            --ips-label-bg-active: var(--rr-label-bg-active, #1f2f7f);
            --ips-label-color: var(--rr-label-color, white);
          }
        }

        @media (max-width: 450px) {
          :host {
            position: initial;
            max-height: 40vh;
          }

          :host(.inactive) .content {
            display: none;
          }

          :host:has(.modalbg) {
            position: absolute;
            .content {
              display: block;
            }
          }

          .label {
            border: 1px solid var(--ips-border-color);
            border-bottom: none;
            border-radius: 0;
          }

          .content {
            border: 1px solid var(--ips-border-color);
            border-radius: 0;
            overflow: scroll;
          }

          .content.resizeable {
            padding: 1ex;
            width: 100% !important;
            height: 100% !important;
          }

          .right-resizer,
          .bottom-resizer,
          .corner-resizer {
            display: none;
          }
        }
      `]}render(){return this.closed?g:p`${this.modal?p`<div class="modalbg"></div>`:g}
      <div
        class="label${this.moving?" moving":""}${this.modal?" modal":""}"
        @pointerdown=${this.onLabelPointerDown}
      >
        <div class="label-left" @pointerdown=${this.noPointerDown}>
          <slot name="label-left"></slot>
        </div>
        <div class="label-middle"><slot name="label">${this.label}</slot></div>
        <div class="label-right" @pointerdown=${this.noPointerDown}>
          <slot name="label-right"></slot>${this.closeable?p`<button id="close" @click=${this.onClosePressed}>
                ${Nn}
              </button>`:g}
        </div>
      </div>
      <div class="content${this.resizeable?" resizeable":""}">
        <div class="contentView"><slot></slot></div>
        ${this.resizeable?p`<div
                class="right-resizer"
                @pointerdown=${this.onRightResizerPointerDown}
              ></div>
              <div
                class="bottom-resizer"
                @pointerdown=${this.onBottomResizerPointerDown}
              ></div>
              <div
                class="corner-resizer"
                @pointerdown=${this.onCornerResizerPointerDown}
              >
                ${zn}
              </div>`:g}
      </div>`}connectedCallback(){super.connectedCallback(),this.addEventListener("click",e=>this.onSelect(e)),Je?.register(this)}disconnectedCallback(){super.disconnectedCallback(),Je?.unregister(this)}firstUpdated(e){super.firstUpdated(e),this.doUpdates(e)}updated(e){super.updated(e),this.doUpdates(e)}doUpdates(e){e.has("closed")&&(Je?.show(!this.closed,this),this.closed||(this.modal||(this.moveController=new V(new Ws(this),0)),this.rightResizeController=new V(new Vt(this,this.content,!0,!1),0),this.bottomResizeController=new V(new Vt(this,this.content,!1,!0),0),this.cornerResizeController=new V(new Vt(this,this.content,!0,!0),0),this.dispatchEvent(new Gs))),this.closed||(this.modal&&(this.pendingSize=void 0,this.pendingPosition=void 0,this.setCenterPosition(),setTimeout(()=>Je?.select(this),0)),this.pendingSize&&(this.setSize(this.pendingSize),this.pendingSize=void 0),this.pendingPosition&&(this.setPosition(this.pendingPosition),this.pendingPosition=void 0))}getPosition(){if(!(this.closed||this.offsetWidth==0&&this.offsetHeight==0)&&getComputedStyle(this).position=="absolute")return{top:this.offsetTop,left:this.offsetLeft,bottom:visualViewport.height-this.offsetTop-this.offsetHeight,right:visualViewport.width-this.offsetLeft-this.offsetWidth}}getSize(){if(!(!this.resizeable||!this.content||this.closed||this.offsetWidth==0&&this.offsetWidth==0)&&getComputedStyle(this).position=="absolute")return{width:this.offsetWidth,height:this.content.offsetHeight}}setCenterPosition(){let e=this.offsetWidth,t=this.offsetHeight;this.style.left=`calc(50vw - ${e/2}px)`,this.style.top=`calc(50vh - ${t/2}px)`,this.style.right="auto",this.style.bottom="auto"}setPosition(e){let t=visualViewport.width,i=visualViewport.height,s=e.left+this.offsetWidth<=t,n=e.right+this.offsetWidth<=t,o=e.top+this.offsetHeight<=i,a=e.bottom+this.offsetHeight<=i,l=e.left<=e.right,c=e.top<=e.bottom;l&&s?(this.style.left=`${e.left}px`,this.style.right="auto"):!l&&n?(this.style.right=`${e.right}px`,this.style.left="auto"):(this.style.left=`${Math.max(0,Math.floor((t-this.offsetWidth)/2))}px`,this.style.right="auto"),c&&o?(this.style.top=`${e.top}px`,this.style.bottom="auto"):!c&&a?(this.style.bottom=`${e.bottom}px`,this.style.top="auto"):(this.style.top=`${Math.max(0,Math.floor((i-this.offsetHeight)/2))}px`,this.style.bottom="auto")}setSize(e){if(this.content===void 0)return;let t=visualViewport.width,i=visualViewport.height,s=this.offsetTop+this.content.offsetTop,n=this.offsetLeft+this.content.offsetLeft;e.width>=t&&(e.width=Math.floor(t)),e.height+this.content.offsetTop>=i&&(e.height=Math.floor(i-this.content.offsetTop));let o=n+this.content.offsetWidth<=t,a=s+this.content.offsetHeight<=i;if(!o){let l=Math.floor(t-e.width-this.content.offsetLeft);this.style.left=`${l}px`,this.style.right="auto"}if(!a){let l=Math.floor(i-e.height-this.content.offsetTop);this.style.top=`${l}px`,this.style.bottom="auto"}Zs(this,this.content,e.width,e.height)}onClosePressed(){this.closed=!0,this.dispatchEvent(new Vs)}onSelect(e){Je?.select(this)&&e.stopPropagation()}noPointerDown(e){e.stopPropagation()}onLabelPointerDown(e){this.fixed||this.moveController?.startDragging(e)}onRightResizerPointerDown(e){this.fixed||this.rightResizeController?.startDragging(e)}onBottomResizerPointerDown(e){this.fixed||this.bottomResizeController?.startDragging(e)}onCornerResizerPointerDown(e){this.fixed||this.cornerResizeController?.startDragging(e)}};ie([h({type:String,reflect:!0}),G("design:type",String)],N.prototype,"label",void 0);ie([h({type:Boolean,reflect:!0}),G("design:type",Boolean)],N.prototype,"resizeable",void 0);ie([h({type:Boolean,reflect:!0}),G("design:type",Boolean)],N.prototype,"closeable",void 0);ie([h({type:Boolean,reflect:!0}),G("design:type",Boolean)],N.prototype,"fixed",void 0);ie([h({type:Boolean,reflect:!0}),G("design:type",Boolean)],N.prototype,"closed",void 0);ie([h({type:Boolean,reflect:!0}),G("design:type",Boolean)],N.prototype,"modal",void 0);ie([h({attribute:!1}),G("design:type",Object),G("design:paramtypes",[Object])],N.prototype,"position",null);ie([h({attribute:!1}),G("design:type",Object),G("design:paramtypes",[Object])],N.prototype,"size",null);ie([b(),G("design:type",Boolean)],N.prototype,"moving",void 0);ie([R(".content"),G("design:type",typeof(io=typeof HTMLDivElement<"u"&&HTMLDivElement)=="function"?io:Object)],N.prototype,"content",void 0);N=ie([D("rr-window")],N);function ut(r){class e extends r{set closed(i){this.pendingClosed=i}get closed(){return this.pendingClosed!==void 0?this.pendingClosed:this.window?.closed||!1}set position(i){this.pendingPosition=i}get position(){return this.pendingPosition||this.window?.position}set size(i){this.pendingSize=i}get size(){return this.pendingSize||this.window?.size}firstUpdated(i){super.firstUpdated(i),this.doUpdate()}updated(i){super.updated(i),this.doUpdate()}doUpdate(){this.pendingClosed!==void 0&&this.window&&(this.window.closed=this.pendingClosed,this.pendingClosed=void 0),this.pendingSize!==void 0&&this.window&&(this.window.size=this.pendingSize,this.pendingSize=void 0),this.pendingPosition!==void 0&&this.window&&(this.window.position=this.pendingPosition,this.pendingPosition=void 0)}}return ie([h({type:Boolean,reflect:!0}),G("design:type",Boolean),G("design:paramtypes",[Boolean])],e.prototype,"closed",null),ie([h({attribute:!1}),G("design:type",Object),G("design:paramtypes",[Object])],e.prototype,"position",null),ie([h({attribute:!1}),G("design:type",Object),G("design:paramtypes",[Object])],e.prototype,"size",null),e}function so(r){let e=r.getBoundingClientRect(),t=e.left+window.scrollX,i=e.top+window.scrollY;r.style.left=`${t}px`,r.style.top=`${i}px`,r.style.right="auto",r.style.bottom="auto"}function ka(r,e,t){let i=r.offsetLeft,s=r.offsetTop;e>visualViewport.width-r.offsetWidth&&(e=visualViewport.width-r.offsetWidth),t>visualViewport.height-r.offsetHeight&&(t=visualViewport.height-r.offsetHeight),e<0&&(e=0),t<0&&(t=0),(e!=i||t!=s)&&ro(r,Math.floor(e),Math.floor(t))}function Ba(r,e,t,i){let s=r.offsetLeft,n=r.offsetTop,o=e.offsetTop;s+t>visualViewport.width&&(t=visualViewport.width-s),n+o+i>visualViewport.height&&(i=visualViewport.height-n-o),i<32&&(i=32),(t!=e.offsetWidth||i!=e.offsetHeight)&&Zs(r,e,Math.floor(t),Math.floor(i))}function ro(r,e,t){r.style.left=e+"px",r.style.top=t+"px"}function Zs(r,e,t,i){e.style.width=t+"px",e.style.height=i+"px",e.offsetWidth<r.offsetWidth&&(e.style.width=r.offsetWidth+"px")}var Ws=class{constructor(e){this.window=e,this.elemX=e.offsetLeft,this.elemY=e.offsetTop}startDrag(){so(this.window),this.window.moving=!0,this.elemX=this.window.offsetLeft,this.elemY=this.window.offsetTop}drag(e,t){ka(this.window,this.elemX+e,this.elemY+t)}finishDrag(){this.window.moving=!1,this.window.dispatchEvent(new Ui)}cancelDrag(){this.window.moving=!1,ro(this.window,this.elemX,this.elemY)}onClick(){}},Vt=class{constructor(e,t,i,s){this.window=e,this.content=t,this.right=i,this.bottom=s,this.sizeX=t.offsetWidth,this.sizeY=t.offsetHeight}startDrag(){so(this.window),this.sizeX=this.content.offsetWidth,this.sizeY=this.content.offsetHeight}drag(e,t){Ba(this.window,this.content,this.right?this.sizeX+e:this.sizeX,this.bottom?this.sizeY+t:this.sizeY)}finishDrag(){this.window.dispatchEvent(new Ui),this.window.dispatchEvent(new js)}cancelDrag(){Zs(this.window,this.content,this.sizeX,this.sizeY)}onClick(){}},Hs=class{constructor(){this.windows=[]}register(e){this.windows.unshift(e),this.update()}unregister(e){let t=this.windows.findIndex(i=>i===e);t<0||(this.windows.splice(t,1),this.update())}show(e,t){e||this.hide(t)}select(e){if(this.windows[this.windows.length-1]===e)return!1;let t=this.windows.findIndex(i=>i===e&&!i.closed);return t<0?!1:(this.windows.splice(t,1),this.windows.push(e),this.update(),!0)}hide(e){if(this.windows[0]===e)return;let t=this.windows.findIndex(i=>i===e);t<0||(this.windows.splice(t,1),this.windows.unshift(e),this.update())}update(){if(this.windows.length==0)return;let e=this.windows.length-1;for(let t=0;t<e;++t)this.windows[t].classList.add("inactive"),this.windows[t].style.zIndex=String(t);this.windows[e].classList.remove("inactive"),this.windows[e].style.zIndex=String(e)}},Je;function no(){Je||(Je=new Hs)}var Ui=class extends Event{constructor(){super("rr-window-moved",{bubbles:!0,composed:!0})}},js=class extends Event{constructor(){super("rr-window-resized",{bubbles:!0,composed:!0})}},Vs=class extends Event{constructor(){super("rr-window-closed",{bubbles:!0,composed:!0})}},Gs=class extends Event{constructor(){super("rr-window-open",{bubbles:!0,composed:!0})}};var ft=function(r,e,t,i){var s=arguments.length,n=s<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,t):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,e,t,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(e,t,n):o(e,t))||n);return s>3&&n&&Object.defineProperty(e,t,n),n},pt=function(r,e){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,e)},et=class extends x{constructor(){super(...arguments),this.min=0,this.frequency=0,this._scale=1,this.step=1}get scale(){return this._scale}set scale(e){if(e!=1&&e!=1e3&&e!=1e6)return;let t=this._scale;this._scale=e,this.requestUpdate("scale",t)}static get styles(){return[S`
        input {
          width: 13ex;
        }

        @media (prefers-color-scheme: dark) {
          input,
          select {
            background: #222;
            color: #ddd;
          }
        }
      `]}render(){return p`<input
        type="number"
        id="frequency"
        .step=${String(this.step/this.scale)}
        .value=${String(this.frequency/this.scale)}
        @change=${this.onFrequencyChange}
      /><select id="scale" @change=${this.onScaleChange}>
        <option value="1" .selected=${this.scale==1}>Hz</option>
        <option value="1000" .selected=${this.scale==1e3}>kHz</option>
        <option value="1000000" .selected=${this.scale==1e6}>MHz</option>
      </select>`}onFrequencyChange(e){let t=e.target,i=Number(t.value);if(!isNaN(i)){let s=i*this.scale;if(s>=this.min&&(this.max===void 0||s<=this.max)){this.frequency=i*this.scale,this.dispatchEvent(new Event("change"));return}}t.value=String(this.frequency/this.scale)}onScaleChange(e){let t=e.target,i=Number(t.selectedOptions[0].value);this.scale=i,this.dispatchEvent(new Event("scale-change"))}};ft([h({type:Number,reflect:!0}),pt("design:type",Number)],et.prototype,"min",void 0);ft([h({type:Number,reflect:!0}),pt("design:type",Number)],et.prototype,"max",void 0);ft([h({type:Number,reflect:!0}),pt("design:type",Number)],et.prototype,"frequency",void 0);ft([h({type:Number,reflect:!0}),pt("design:type",Number),pt("design:paramtypes",[Number])],et.prototype,"scale",null);ft([h({type:Number,reflect:!0}),pt("design:type",Number)],et.prototype,"step",void 0);et=ft([D("rr-frequency-input")],et);var I=function(r,e,t,i){var s=arguments.length,n=s<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,t):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,e,t,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(e,t,n):o(e,t))||n);return s>3&&n&&Object.defineProperty(e,t,n),n},z=function(r,e){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,e)},oo,ao,E=class extends ut(x){constructor(){super(...arguments),this.inline=!1,this.hidden=!1,this.tunedFrequency=885e5,this.scale=1e3,this.tuningStep=1e3,this.scheme="WBFM",this.bandwidth=15e4,this.stereo=!0,this.squelch=0,this.gain=null,this.sortColumn="frequency",this.presets=[],this.sortedIndices=[],this.editorOpen=!1,this.editorContent={name:"",tunedFrequency:this.tunedFrequency,scale:this.scale,tuningStep:this.tuningStep,scheme:this.scheme,bandwidth:this.bandwidth,stereo:this.stereo,squelch:this.squelch,gain:this.gain}}static get styles(){return[te,S`
        table {
          border-collapse: collapse;
          width: 100%;
          cursor: default;
        }

        tr.active {
          background: #7bd;
        }

        tr:nth-child(even) {
          background: #eee;
          &.active {
            background: #6bd;
          }
        }

        td:nth-child(n + 2) {
          width: 0;
        }

        th,
        td {
          text-wrap: nowrap;
          padding: 0.4ex 0.8ex;
          cursor: pointer;
        }

        td:first-child {
          max-width: 15ex;
          text-overflow: ellipsis;
          overflow: hidden;
        }

        svg {
          vertical-align: text-top;
        }

        a svg {
          fill: #22e;
        }

        .buttonIllustration {
          position: relative;
          top: 0.5ex;
          margin-top: -2ex;
          z-index: 0;
        }

        #preset-editor {
          bottom: inherit;
          right: inherit;
          margin: auto;

          div:first-child {
            margin-bottom: 1ex;
          }
          div:last-child {
            margin-top: 1ex;
          }
        }

        @media (prefers-color-scheme: dark) {
          tr.active {
            background: #135;
          }

          tr:nth-child(even) {
            background: #333;
            &.active {
              background: #147;
            }
          }

          a svg {
            fill: #55f;
          }
        }
      `]}render(){return p`<rr-window
        label=${this.selectedIndex===void 0?"Presets":`Current preset: ${this.presets[this.selectedIndex].name}`}
        id="presets"
        class=${this.inline?"inline":""}
        closeable
        .closed=${this.closed}
        .position=${this.position}
        .size=${this.size}
        .fixed=${this.inline}
        .resizeable=${!0}
      >
        <button
          slot="label-left"
          .disabled=${this.selectedIndex!==void 0}
          @click=${this.onAddClick}
        >
          ${Us}
        </button>
        <table>
          <tr>
            <th id="name" @click=${this.onHeaderClick}>
              Name${this.getSortArrow("name")}
            </th>
            <th id="frequency" @click=${this.onHeaderClick}>
              Frequency${this.getSortArrow("frequency")}
            </th>
            <th id="mode" @click=${this.onHeaderClick}>
              Mode${this.getSortArrow("mode")}
            </th>
            <th></th>
          </tr>
          ${this.sortedIndices.map(e=>p`<tr
                data-index=${e}
                class=${e==this.selectedIndex?"active":""}
                @click=${this.onRowClick}
              >
                <td>${this.presets[e].name}</td>
                <td>
                  ${Wi(this.presets[e].tunedFrequency,this.presets[e].scale)}
                </td>
                <td>${this.presets[e].scheme}</td>
                <td>
                  <a href="javascript:0" @click=${this.onRowEditClick}
                    >${Xn}</a
                  ><a href="javascript:0" @click=${this.onRowDeleteClick}
                    >${Yn}</a
                  >
                </td>
              </tr>`)}
        </table>
        ${this.presets.length==0?p`<p style="max-width: 50ex">
              You can use Presets to flip quickly to your favorite stations or
              frequencies. Click the
              <button disabled class="buttonIllustration">${Us}</button>
              button on this window's top left corner to add the current
              frequency to the presets.
            </p>`:g}
      </rr-window>

      <rr-window
        id="preset-editor"
        .label=${this.editorTitle||""}
        closeable
        modal
        .closed=${!this.editorOpen}
        @rr-window-open=${this.onEditorOpen}
        @rr-window-closed=${this.onEditorClosed}
      >
        <div>
          <label for="presetName">Name: </label
          ><input
            id="presetName"
            type="text"
            .value=${this.editorContent.name}
            @keydown=${this.onEditorNameKeydown}
            @input=${this.onEditorNameChange}
          />
        </div>
        <div>
          Frequency:
          <b
            >${Wi(this.editorContent.tunedFrequency,this.editorContent.scale)}</b
          >, Tuning step:
          <b>${Wi(this.editorContent.tuningStep,1)}</b>
        </div>
        <div>
          Modulation:
          <b
            >${this.editorContent.scheme}${T(this.editorContent.scheme).hasStereo()?this.editorContent.stereo?" Stereo":" Mono":g}</b
          >${T(this.editorContent.scheme).hasBandwidth()?p`, Bandwidth:
                <b>${Wi(this.editorContent.bandwidth,1)}</b>`:g}
        </div>
        <div>
          Gain:
          <b
            >${this.editorContent.gain===null?"Auto":this.editorContent.gain}</b
          >${T(this.editorContent.scheme).hasSquelch()?p`, Squelch: <b>${this.editorContent.squelch}</b>`:g}
        </div>
        ${this.editorIndex!==void 0?p`<div>
              <button @click=${this.onEditorReplaceClick}>
                Replace with current settings
              </button>
            </div>`:g}
        <div>
          <button
            .disabled=${this.editorValidationError!==void 0}
            @click=${this.onEditorSaveClick}
          >
            Save</button
          >${this.editorValidationError!==void 0?p` <i>${this.editorValidationError}</i>`:g}
        </div>
      </rr-window>`}willUpdate(e){super.willUpdate(e),(e.has("presets")||e.has("sortColumn"))&&this.updatePresetLists(),this.findSelectedIndex()}updatePresetLists(){let e=[...this.presets.keys()];e.sort(this.getSortFormula()),this.sortedIndices=e}onAddClick(e){this.editorTitle="New Preset",this.editorIndex=void 0,this.editorContent={name:"",tunedFrequency:this.tunedFrequency,scale:this.scale,tuningStep:this.tuningStep,scheme:this.scheme,bandwidth:this.bandwidth,stereo:this.stereo,squelch:this.squelch,gain:this.gain},this.checkValidEditor(),this.editorOpen=!0}onEditorNameKeydown(e){e.key=="Enter"?(e.preventDefault(),this.onEditorSaveClick()):e.key=="Escape"&&(e.preventDefault(),this.onEditorClosed())}onEditorNameChange(e){let i=e.target.value;this.editorContent.name=i,this.checkValidEditor()}onEditorReplaceClick(){this.editorContent={name:this.editorContent.name,tunedFrequency:this.tunedFrequency,scale:this.scale,tuningStep:this.tuningStep,scheme:this.scheme,bandwidth:this.bandwidth,stereo:this.stereo,squelch:this.squelch,gain:this.gain},this.checkValidEditor()}checkValidEditor(){if(this.editorContent.name==""){this.editorValidationError="Preset name is empty";return}let e=this.presets.findIndex(t=>t.name==this.editorContent.name);if(e>=0&&e!=this.editorIndex){this.editorValidationError="There is another preset with that name";return}if(e=this.presets.findIndex(t=>lo(t,this.editorContent)),e>=0&&e!=this.editorIndex){this.editorValidationError=`There is an identical preset: ${this.presets[e].name}`;return}this.editorValidationError=void 0}onEditorSaveClick(){let e=[...this.presets];this.editorIndex===void 0||this.editorIndex>=e.length?e.push({...this.editorContent}):e[this.editorIndex]={...this.editorContent},this.editorOpen=!1,this.presets=e,this.dispatchEvent(new Hi)}onEditorOpen(){this.presetName&&this.presetName.focus()}onEditorClosed(){this.editorOpen=!1}onRowClick(e){let t=this.getIndex(e);t!==void 0&&(this.selectedIndex=t,this.dispatchEvent(new Ks))}onRowEditClick(e){e.stopPropagation();let t=this.getIndex(e);if(t===void 0)return;let i={...this.presets[t]};this.editorTitle=`Editing Preset "${i.name}"`,this.editorIndex=t,this.editorContent=i,this.checkValidEditor(),this.editorOpen=!0}onRowDeleteClick(e){e.stopPropagation();let t=this.getIndex(e);if(t===void 0)return;let i=[...this.presets];i.splice(t,1),this.selectedIndex=void 0,this.presets=i,this.dispatchEvent(new Hi)}getIndex(e){let t=e.target;for(;t!=null&&t.tagName!="TR";)t=t.parentElement;if(t==null)return;let i=Number(t.dataset.index);if(!isNaN(i))return i}onHeaderClick(e){let t=e.currentTarget.id,i=`-${t}`;this.sortColumn===t?this.sortColumn=i:this.sortColumn=t,this.dispatchEvent(new Qs)}getSortArrow(e){return this.sortColumn===e?to:this.sortColumn===`-${e}`?eo:g}getSortFormula(){let e=this.sortColumn||"frequency",t=e[0]=="-";t&&(e=e.substring(1));let i;switch(e){case"name":i=(s,n)=>this.presets[s].name.localeCompare(this.presets[n].name);break;case"mode":i=(s,n)=>this.presets[s].scheme.localeCompare(this.presets[n].scheme);break;default:i=(s,n)=>this.presets[s].tunedFrequency-this.presets[n].tunedFrequency;break}return t?(s,n)=>i(n,s):i}findSelectedIndex(){let e=this.presets.findIndex(t=>lo(t,this));e<0?this.selectedIndex=void 0:this.selectedIndex=e}};I([h({attribute:!1}),z("design:type",Boolean)],E.prototype,"inline",void 0);I([h({attribute:!1}),z("design:type",Boolean)],E.prototype,"hidden",void 0);I([h({attribute:!1}),z("design:type",Number)],E.prototype,"tunedFrequency",void 0);I([h({attribute:!1}),z("design:type",Number)],E.prototype,"scale",void 0);I([h({attribute:!1}),z("design:type",Number)],E.prototype,"tuningStep",void 0);I([h({attribute:!1}),z("design:type",String)],E.prototype,"scheme",void 0);I([h({attribute:!1}),z("design:type",Number)],E.prototype,"bandwidth",void 0);I([h({attribute:!1}),z("design:type",Boolean)],E.prototype,"stereo",void 0);I([h({attribute:!1}),z("design:type",Number)],E.prototype,"squelch",void 0);I([h({attribute:!1}),z("design:type",Object)],E.prototype,"gain",void 0);I([h({attribute:!1}),z("design:type",Number)],E.prototype,"selectedIndex",void 0);I([h({attribute:!1}),z("design:type",String)],E.prototype,"sortColumn",void 0);I([h({attribute:!1}),z("design:type",Array)],E.prototype,"presets",void 0);I([b(),z("design:type",Array)],E.prototype,"sortedIndices",void 0);I([b(),z("design:type",String)],E.prototype,"editorTitle",void 0);I([b(),z("design:type",Boolean)],E.prototype,"editorOpen",void 0);I([b(),z("design:type",Number)],E.prototype,"editorIndex",void 0);I([b(),z("design:type",String)],E.prototype,"editorValidationError",void 0);I([b(),z("design:type",Object)],E.prototype,"editorContent",void 0);I([R("#presets"),z("design:type",typeof(oo=typeof N<"u"&&N)=="function"?oo:Object)],E.prototype,"window",void 0);I([R("#presetName"),z("design:type",typeof(ao=typeof HTMLInputElement<"u"&&HTMLInputElement)=="function"?ao:Object)],E.prototype,"presetName",void 0);E=I([D("rr-presets")],E);var Ks=class extends Event{constructor(){super("rr-preset-selected",{bubbles:!0,composed:!0})}},Hi=class extends Event{constructor(){super("rr-presets-changed",{bubbles:!0,composed:!0})}},Qs=class extends Event{constructor(){super("rr-presets-sorted",{bubbles:!0,composed:!0})}};function lo(r,e){return r.tunedFrequency===e.tunedFrequency&&r.scale===e.scale&&r.tuningStep===e.tuningStep&&r.bandwidth===e.bandwidth&&r.stereo===e.stereo&&r.squelch===e.squelch&&r.gain===e.gain}function Wi(r,e){switch(e){case 1e3:return`${String(r/1e3)} kHz`;case 1e6:return`${String(r/1e6)} MHz`;default:return`${String(r)} Hz`}}var P=function(r,e,t,i){var s=arguments.length,n=s<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,t):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,e,t,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(e,t,n):o(e,t))||n);return s>3&&n&&Object.defineProperty(e,t,n),n},k=function(r,e){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,e)},ho,M=class extends ut(x){constructor(){super(...arguments),this.inline=!1,this.showSettings=!0,this.showHelp=!0,this.needsReload=!1,this.playing=!1,this.scale=1e3,this.centerFrequency=885e5,this.tunedFrequency=885e5,this.tuningStep=1e3,this.availableSchemes=at(),this.scheme="WBFM",this.bandwidth=15e4,this.stereo=!0,this.squelch=0,this.stereoStatus=!1,this.gain=null,this.gainDisabled=!1,this.maxFrequency=18e8,this.deviceLabel="No SDR",this.dspActive=!1,this.gpsLabel="GPS off",this.gpsState="",this.savedGain=0}static get styles(){return[te,S`
        rr-window {
          right: auto;
          left: 1em;
        }

        .cfgBlock {
          display: inline-flex;
          flex-direction: column;
        }

        #bandwidth {
          width: 9ex;
        }

        #stereoIcon {
          vertical-align: bottom;
          fill: #bbb;
        }

        #stereoIcon.stereo {
          fill: #060;
        }

        #squelch {
          width: 12ex;
        }

        @media (prefers-color-scheme: dark) {
          #stereoIcon {
            fill: #666;
          }

          #stereoIcon.stereo {
            fill: #0b0;
          }
        }

        .status {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 6px;
          max-width: 46ch;
        }

        .chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.78em;
          line-height: 1.2;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid rgba(127, 127, 127, 0.35);
          background: rgba(127, 127, 127, 0.08);
          color: inherit;
          cursor: pointer;
          text-decoration: none;
          white-space: nowrap;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          min-height: 0;
        }

        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #94a3b8;
          flex: none;
        }

        .dot.ok {
          background: #22c55e;
        }

        .dot.warn {
          background: #f59e0b;
        }

        .dot.err {
          background: #ef4444;
        }

        label[for="centerFrequency"],
        label[for="tunedFrequency"],
        label[for="tuningStep"] {
          width: 16ex;
          display: inline-block;
          text-align: right;
          padding-right: 0.5ex;
        }
      `]}render(){return p`<rr-window
      label="Controls"
      id="controls"
      class=${this.inline?"inline":""}
      .position=${this.position}
      .fixed=${this.inline}
    >
      ${this.needsReload?p`<button slot="label-left" id="needsReload" @click=${this.onReload}>
            ${Qn}
          </button>`:this.playing?p`<button slot="label-left" id="stop" @click=${this.onStop}>
              ${On}
            </button>`:p`<button slot="label-left" id="start" @click=${this.onStart}>
              ${Ln}
            </button>`}
      <button slot="label-right" id="presets" @click=${this.onPresets}>
        ${Jn}
      </button>
      ${this.showSettings?p`<button
            slot="label-right"
            id="settings"
            @click=${this.onSettings}
          >
            ${Un}
          </button>`:g}
      ${this.showHelp?p`<a slot="label-right" href="help.html" target="_blank"
            ><button id="help">${Wn}</button></a
          >`:g}
      <div class="status">
        <button class="chip" id="deviceChip" title="Device settings" @click=${this.onSettings}>
          <span class="dot ${this.playing?"ok":""}"></span>${this.deviceLabel}
        </button>
        <button class="chip" id="dspChip" title="DSP engine" @click=${this.onSettings}>
          <span class="dot ${this.dspActive?"ok":"warn"}"></span>${this.dspActive?"Rust/WASM DSP":"JS DSP"}
        </button>
        <button class="chip" id="gpsChip" title="GPS settings" @click=${this.onSettings}>
          <span class="dot ${this.gpsState}"></span>${this.gpsLabel}
        </button>
        <a class="chip" id="monitorLink" href="thesis-view.html" title="Open the MMN monitor"
          >📊 Monitor</a
        >
      </div>
      <div>
        <label for="centerFrequency">Center frequency: </label
        ><rr-frequency-input
          id="centerFrequency"
          .min=${0}
          .max=${this.maxFrequency}
          .frequency=${this.centerFrequency}
          .scale=${this.scale}
          .step=${this.tuningStep}
          @change=${this.onCenterFrequencyChange}
          @scale-change=${this.onScaleChange}
        ></rr-frequency-input>
      </div>
      <div>
        <label for="tunedFrequency">Tuned frequency: </label
        ><rr-frequency-input
          id="tunedFrequency"
          .min=${0}
          .max=${this.maxFrequency}
          .frequency=${this.tunedFrequency}
          .scale=${this.scale}
          .step=${this.tuningStep}
          @change=${this.onTunedFrequencyChange}
          @scale-change=${this.onScaleChange}
        ></rr-frequency-input>
      </div>
      <div>
        <label for="tuningStep">Tuning step: </label
        ><input
          id="tuningStep"
          type="number"
          min="1"
          max="500000"
          .value=${String(this.tuningStep)}
          @change=${this.onTuningStepChange}
        />
        Hz
      </div>
      <div>
        <label for="scheme">Modulation: </label>
        <select id="scheme" @change=${this.onModeChange}>
          ${this.availableSchemes.map(e=>p`<option value="${e}" .selected=${this.scheme==e}>
                ${e}
              </option>`)}
        </select>
        <div class="cfgBlock">
          <span .hidden=${!T(this.scheme).hasBandwidth()}
            ><label for="bandwidth">Bandwidth: </label
            ><input
              type="number"
              id="bandwidth"
              min="0"
              max="20000"
              step="1"
              .value=${String(this.bandwidth)}
              @change=${this.onBandwidthChange} /></span
          ><span .hidden=${!T(this.scheme).hasStereo()}>
            <label for="stereo">Stereo: </label
            ><input
              type="checkbox"
              id="stereo"
              .checked=${this.stereo}
              @change=${this.onStereoChange}
            />
            <span
              id="stereoIcon"
              class=${this.stereoStatus?"stereo":"mono"}
              .hidden=${!T(this.scheme).hasStereo()||!this.stereo}
              >${Kn}</span
            ></span
          ><span .hidden=${!T(this.scheme).hasSquelch()}>
            <label for="squelch">Squelch: </label
            ><input
              type="range"
              id="squelch"
              min="0"
              max="6"
              step="0.1"
              .value=${String(this.squelch)}
              @input=${this.onSquelchChange}
            />
          </span>
        </div>
      </div>
      <div>
        <label for="gain">Gain: </label
        ><input
          type="range"
          id="gain"
          min="0"
          max="50"
          .value=${this.gain===null?String(this.savedGain):String(this.gain)}
          .disabled=${this.gain===null||this.gainDisabled}
          @input=${this.onGainInput}
        />
        <input
          type="checkbox"
          id="gainAuto"
          .checked=${this.gain===null||this.gainDisabled}
          .disabled=${this.gainDisabled}
          @change=${this.onGainAutoChange}
        />
        <label for="gainAuto">Auto gain</label>
      </div>
    </rr-window>`}onStart(){this.dispatchEvent(new Xs)}onStop(){this.dispatchEvent(new Ys)}onReload(){location.reload()}onPresets(){this.dispatchEvent(new Js)}onSettings(){this.dispatchEvent(new er)}onScaleChange(e){let t=e.target;this.scale=t.scale,this.dispatchEvent(new tr)}onCenterFrequencyChange(e){let t=e.target;this.centerFrequency=t.frequency,this.dispatchEvent(new ir)}onTunedFrequencyChange(e){let t=e.target;this.tunedFrequency=t.frequency,this.dispatchEvent(new sr)}onTuningStepChange(e){let t=e.target,i=Number(t.value);if(isNaN(i)){t.value=String(this.tuningStep);return}this.tuningStep=i,this.dispatchEvent(new rr)}onModeChange(e){this.scheme=e.target.selectedOptions[0].value,this.dispatchEvent(new nr)}onBandwidthChange(e){let t=e.target,i=Number(t.value);if(isNaN(i)){t.value=String(this.bandwidth);return}this.bandwidth=i,this.dispatchEvent(new or)}onStereoChange(e){let t=e.target;this.stereo=t.checked,this.dispatchEvent(new ar)}onSquelchChange(e){let t=e.target,i=Number(t.value);(isNaN(i)||i<0)&&(i=0,t.value=String(i)),i>6&&(i=6,t.value=String(i)),this.squelch=i,this.dispatchEvent(new lr)}onGainInput(e){let t=e.target,i=Number(t.value);if(isNaN(i)){t.value=this.gain==null?"":String(this.gain);return}this.gain=i,this.dispatchEvent(new ji)}onGainAutoChange(e){e.target.checked?(this.gain!=null&&(this.savedGain=this.gain),this.gain=null):this.gain=this.savedGain,this.dispatchEvent(new ji)}};P([h({attribute:!1}),k("design:type",Boolean)],M.prototype,"inline",void 0);P([h({attribute:!1}),k("design:type",Boolean)],M.prototype,"showSettings",void 0);P([h({attribute:!1}),k("design:type",Boolean)],M.prototype,"showHelp",void 0);P([h({attribute:!1}),k("design:type",Boolean)],M.prototype,"needsReload",void 0);P([h({attribute:!1}),k("design:type",Boolean)],M.prototype,"playing",void 0);P([h({attribute:!1}),k("design:type",Number)],M.prototype,"scale",void 0);P([h({attribute:!1}),k("design:type",Number)],M.prototype,"centerFrequency",void 0);P([h({attribute:!1}),k("design:type",Number)],M.prototype,"tunedFrequency",void 0);P([h({attribute:!1}),k("design:type",Number)],M.prototype,"tuningStep",void 0);P([h({attribute:!1}),k("design:type",Array)],M.prototype,"availableSchemes",void 0);P([h({attribute:!1}),k("design:type",String)],M.prototype,"scheme",void 0);P([h({attribute:!1}),k("design:type",Number)],M.prototype,"bandwidth",void 0);P([h({attribute:!1}),k("design:type",Boolean)],M.prototype,"stereo",void 0);P([h({attribute:!1}),k("design:type",Number)],M.prototype,"squelch",void 0);P([h({attribute:!1}),k("design:type",Boolean)],M.prototype,"stereoStatus",void 0);P([h({attribute:!1}),k("design:type",Object)],M.prototype,"gain",void 0);P([h({attribute:!1}),k("design:type",Boolean)],M.prototype,"gainDisabled",void 0);P([h({attribute:!1}),k("design:type",Number)],M.prototype,"maxFrequency",void 0);P([h({attribute:!1}),k("design:type",String)],M.prototype,"deviceLabel",void 0);P([h({attribute:!1}),k("design:type",Boolean)],M.prototype,"dspActive",void 0);P([h({attribute:!1}),k("design:type",String)],M.prototype,"gpsLabel",void 0);P([h({attribute:!1}),k("design:type",String)],M.prototype,"gpsState",void 0);P([b(),k("design:type",Number)],M.prototype,"savedGain",void 0);P([R("rr-window"),k("design:type",typeof(ho=typeof N<"u"&&N)=="function"?ho:Object)],M.prototype,"window",void 0);M=P([D("rr-main-controls")],M);var Xs=class extends Event{constructor(){super("rr-start",{bubbles:!0,composed:!0})}},Ys=class extends Event{constructor(){super("rr-stop",{bubbles:!0,composed:!0})}},Js=class extends Event{constructor(){super("rr-presets",{bubbles:!0,composed:!0})}},er=class extends Event{constructor(){super("rr-settings",{bubbles:!0,composed:!0})}},tr=class extends Event{constructor(){super("rr-scale-changed",{bubbles:!0,composed:!0})}},ir=class extends Event{constructor(){super("rr-center-frequency-changed",{bubbles:!0,composed:!0})}},sr=class extends Event{constructor(){super("rr-tuned-frequency-changed",{bubbles:!0,composed:!0})}},rr=class extends Event{constructor(){super("rr-tuning-step-changed",{bubbles:!0,composed:!0})}},nr=class extends Event{constructor(){super("rr-scheme-changed",{bubbles:!0,composed:!0})}},or=class extends Event{constructor(){super("rr-bandwidth-changed",{bubbles:!0,composed:!0})}},ar=class extends Event{constructor(){super("rr-stereo-changed",{bubbles:!0,composed:!0})}},lr=class extends Event{constructor(){super("rr-squelch-changed",{bubbles:!0,composed:!0})}},ji=class extends Event{constructor(){super("rr-gain-changed",{bubbles:!0,composed:!0})}};var hr=7504,Gi=[{vendorId:hr,productId:24713},{vendorId:hr,productId:24651},{vendorId:hr,productId:52245}];function Zi(r){return Gi.some(e=>e.vendorId===r.vendorId&&e.productId===r.productId)}var Ia={0:"Jellybean",1:"Jawbreaker",2:"HackRF One",3:"rad1o",4:"HackRF One (r9)",5:"HackRF Pro"},Vi=[175e4,25e5,35e5,5e6,55e5,6e6,7e6,8e6,9e6,1e7,12e6,14e6,15e6,2e7,24e6,28e6];function Na(r){let e=Vi.findIndex(t=>t>=r);return e<0&&(e=Vi.length-1),e>0&&Vi[e]>r&&e--,Vi[e]}function za(r){let e=Math.max(0,Math.min(50,r))/50;return{lna:Math.min(40,8*Math.round(e*40/8)),vga:Math.min(62,2*Math.round(e*62/2))}}function Oa(r){for(let e=1;e<32;++e){let t=r*e;if(Math.abs(t-Math.round(t))<1e-6)return{freqHz:Math.round(t),divider:e}}return{freqHz:Math.round(r),divider:1}}function La(){return typeof navigator<"u"&&/Android/i.test(navigator.userAgent)}function Ua(){let r="The HackRF is in use by something else. Close any other webRx tab (Receiver or Monitor) that is using it";return La()?`${r}, and any SDR app on the phone. Unplug the HackRF, plug it back in, and if Android asks which app should open it, dismiss the prompt. Then press Start again.`:`${r}, and other SDR software (SDR#, SDR++, GQRX, hackrf_transfer). Then press Start again.`}var Wa=2e6,Ha=2e7,ja=1e6,Va=6e9,co=262144,Ga=4,Za=1,mt=class r{constructor(e,t){this.device=e;this.info=t;this.sampleRate=2048e3;this.centerFrequency=1e8;this.ppm=0;this.gain=null;this.biasTee=!1;this.ampEnabled=!1;this.directSampling=j.Off;this.streaming=!1;this.generation=0;this.inFlight=0;this.chunks=[];this.chunkOffset=0;this.buffered=0;this.waiters=[];this.failure=null;this.maxBuffered=0}static async claim(e){let t=()=>e.configuration?.interfaces?.find(o=>o.interfaceNumber===0),i=async()=>{e.opened||await e.open(),(!e.configuration||e.configuration.configurationValue!==1)&&await e.selectConfiguration(1),t()?.claimed||await e.claimInterface(0)},s,n=[async()=>{},async()=>{e.opened&&await e.close()},async()=>{e.opened||await e.open(),await e.reset(),await new Promise(o=>setTimeout(o,300))}];for(let o of n){try{await o()}catch{}try{await i();return}catch(a){s=a}}throw new F(Ua(),_.UsbTransferError,{cause:s})}static async open(e,t){await r.claim(e);let i=await r.readByte(e,14),s=await r.readString(e,15),n={boardId:i,boardName:Ia[i]??(e.productName||"HackRF"),firmware:s},o=new r(e,n);return o.ampEnabled=t?.ampEnabled===!0,await o.setMode(0),await o.setSampleRate(o.sampleRate),await o.applyGain(),await o.ctrlOut(17,o.ampEnabled?1:0,0),await o.ctrlOut(23,0,0),o}async setSampleRate(e){let t=Math.max(Wa,Math.min(Ha,e)),{freqHz:i,divider:s}=Oa(t),n=new DataView(new ArrayBuffer(8));n.setUint32(0,i,!0),n.setUint32(4,s,!0),await this.ctrlOut(6,0,0,n.buffer);let o=Na(Math.floor(.75*i/s));return await this.ctrlOut(7,o&65535,o>>>16),this.sampleRate=i/s,this.maxBuffered=Math.max(4*co,Math.ceil(this.sampleRate)),this.sampleRate}async setFrequencyCorrection(e){this.ppm=e,await this.tune(this.centerFrequency)}getFrequencyCorrection(){return this.ppm}async setGain(e){this.gain=e,await this.applyGain()}getGain(){return this.gain}async setCenterFrequency(e){let t=Math.max(ja,Math.min(Va,e));return await this.tune(t),this.centerFrequency=t,t}async setDirectSamplingMethod(e){this.directSampling=e}getDirectSamplingMethod(){return this.directSampling}async enableBiasTee(e){this.biasTee=e,await this.ctrlOut(23,e?1:0,0)}isBiasTeeEnabled(){return this.biasTee}async resetBuffer(){this.chunks=[],this.chunkOffset=0,this.buffered=0,this.failure=null,this.streaming||await this.startStreaming()}readSamples(e){let t=e*2,i=this.centerFrequency;return new Promise((s,n)=>{if(this.failure)return n(this.failure);this.streaming||this.startStreaming().catch(n),this.waiters.push({bytes:t,resolve:s,reject:n}),this.serveWaiters()}).then(s=>({frequency:i,directSampling:!1,data:s.buffer}))}async close(){this.stopStreaming(new F("Device closed",_.UsbTransferError));try{await this.setMode(0)}catch{}try{await this.device.releaseInterface(0)}catch{}try{await this.device.close()}catch{}}async pause(){this.stopStreaming(new F("Receiving paused",_.UsbTransferError)),this.failure=null,await this.setMode(0)}async setAmpEnabled(e){this.ampEnabled=e,await this.ctrlOut(17,e?1:0,0)}isAmpEnabled(){return this.ampEnabled}async startStreaming(){if(this.streaming)return;await this.setMode(1),this.streaming=!0;let e=++this.generation;for(let t=0;t<Ga;++t)this.submitTransfer(e)}stopStreaming(e){this.streaming=!1,++this.generation;let t=this.waiters;this.waiters=[];for(let i of t)i.reject(e)}submitTransfer(e){++this.inFlight,this.device.transferIn(Za,co).then(t=>{if(--this.inFlight,e===this.generation){if(t.status!=="ok"||!t.data){this.fail(new Error(`USB transfer status: ${t.status}`));return}this.push(new Uint8Array(t.data.buffer,t.data.byteOffset,t.data.byteLength)),this.streaming&&e===this.generation&&this.submitTransfer(e)}},t=>{--this.inFlight,e===this.generation&&this.fail(t)})}fail(e){this.failure=new F("HackRF sample transfer failed. Did you unplug the device?",_.UsbTransferError,{cause:e}),this.stopStreaming(this.failure)}push(e){if(e.length!==0){if((e.byteOffset&3)===0&&(e.length&3)===0){let t=new Uint32Array(e.buffer,e.byteOffset,e.length>>2);for(let i=0;i<t.length;++i)t[i]^=2155905152}else for(let t=0;t<e.length;++t)e[t]^=128;for(this.chunks.push(e),this.buffered+=e.length;this.buffered-this.chunkOffset>this.maxBuffered&&this.chunks.length>1;){let t=this.chunks.shift();this.buffered-=t.length,this.chunkOffset=0}this.serveWaiters()}}serveWaiters(){for(;this.waiters.length>0;){let e=this.waiters[0];if(this.buffered-this.chunkOffset<e.bytes)return;this.waiters.shift(),e.resolve(this.take(e.bytes))}}take(e){let t=new Uint8Array(e),i=0;for(;i<e;){let s=this.chunks[0],n=Math.min(e-i,s.length-this.chunkOffset);t.set(s.subarray(this.chunkOffset,this.chunkOffset+n),i),i+=n,this.chunkOffset+=n,this.chunkOffset===s.length&&(this.chunks.shift(),this.buffered-=s.length,this.chunkOffset=0)}return t}async tune(e){let t=Math.round(e/(1+this.ppm/1e6)),i=Math.floor(t/1e6),s=t-i*1e6,n=new DataView(new ArrayBuffer(8));n.setUint32(0,i,!0),n.setUint32(4,s,!0),await this.ctrlOut(16,0,0,n.buffer)}async applyGain(){let{lna:e,vga:t}=this.gain===null?{lna:16,vga:20}:za(this.gain);await this.ctrlInExpectOk(19,e),await this.ctrlInExpectOk(20,t)}setMode(e){return this.ctrlOut(1,e,0)}async ctrlOut(e,t,i,s){let n=await this.device.controlTransferOut({requestType:"vendor",recipient:"device",request:e,value:t,index:i},s);if(n.status!=="ok")throw new F(`HackRF request ${e} failed (${n.status})`,_.UsbTransferError)}async ctrlInExpectOk(e,t){let i=await this.device.controlTransferIn({requestType:"vendor",recipient:"device",request:e,value:0,index:t},1);if(i.status!=="ok"||!i.data||i.data.byteLength<1||i.data.getUint8(0)===0)throw new F(`HackRF rejected setting ${e}=${t}`,_.TunerError)}static async readByte(e,t){let i=await e.controlTransferIn({requestType:"vendor",recipient:"device",request:t,value:0,index:0},1);return i.data&&i.data.byteLength>0?i.data.getUint8(0):255}static async readString(e,t){try{let i=await e.controlTransferIn({requestType:"vendor",recipient:"device",request:t,value:0,index:0},255);return i.data?new TextDecoder().decode(new Uint8Array(i.data.buffer,i.data.byteOffset,i.data.byteLength)).replace(/\0.*$/,""):""}catch{return""}}};var fo=new Map([["auto","Auto (RTL-SDR or HackRF)"],["rtlsdr","RTL-SDR"],["hackrf","HackRF One / HackRF Pro"]]),cr=[{vendorId:3034,productId:10290},{vendorId:3034,productId:10296}];function uo(r){return cr.some(e=>e.vendorId===r.vendorId&&e.productId===r.productId)}function Ka(r){return r>288e4?24e5:r>3e5&&r<=9e5?1024e3:r<=225e3?25e4:r}function Qa(r){return r==="rtlsdr"?cr:r==="hackrf"?Gi:[...cr,...Gi]}function po(r,e){return r==="rtlsdr"?uo(e):r==="hackrf"?Zi(e):uo(e)||Zi(e)}var Ki=class{constructor(e){this.options=e;typeof window<"u"&&window.addEventListener("pagehide",()=>this.release())}release(){let e=this.device;e&&e.opened&&e.close().catch(()=>{})}get connected(){return this.current}get usbDevice(){return this.device}forgetDevice(){this.device=void 0}async get(){let e=this.options.usb??(typeof navigator<"u"?navigator.usb:void 0);if(!e)throw new F("This browser does not support WebUSB. Use Chrome or Edge on a computer or Android phone.",_.NoUsbSupport);let t=this.options.kind();if(this.device&&!po(t,this.device)&&(this.device=void 0),!this.device){let s=(await e.getDevices()).filter(n=>po(t,n));s.length===1&&(this.device=s[0])}if(!this.device)try{this.device=await e.requestDevice({filters:Qa(t)})}catch(s){throw new F("No device was selected",_.NoDeviceSelected,{cause:s})}let i=this.device;if(Zi(i)){let s=await mt.open(i,{ampEnabled:this.options.hackrfAmp?.()});this.current={kind:"hackrf",name:s.info.boardName,detail:s.info.firmware?`firmware ${s.info.firmware}`:void 0,minFrequency:1e6,maxFrequency:6e9,device:s}}else{i.opened&&await i.close().catch(()=>{}),await i.open();let s=await Ht.open(i),n=s.setSampleRate.bind(s);s.setSampleRate=o=>n(Ka(o)),this.current={kind:"rtlsdr",name:i.productName||"RTL-SDR",detail:i.manufacturerName||void 0,minFrequency:0,maxFrequency:18e8,device:s}}return this.options.onConnect?.(this.current),this.current.device}};var bo={0:"No fix",1:"GPS",2:"DGPS",3:"PPS",4:"RTK fixed",5:"RTK float",6:"Estimated",7:"Manual",8:"Simulation"};function Xa(r){let e=r.lastIndexOf("*");if(e<0)return!0;let t=0;for(let s=1;s<e;++s)t^=r.charCodeAt(s);let i=parseInt(r.slice(e+1,e+3),16);return!Number.isNaN(i)&&i===t}function Qi(r,e){if(!r)return;let t=r.indexOf("."),i=(t<0?r.length:t)-2;if(i<1)return;let s=parseInt(r.slice(0,i),10),n=parseFloat(r.slice(i));if(Number.isNaN(s)||Number.isNaN(n))return;let o=s+n/60;return e==="S"||e==="W"?-o:o}function pe(r){if(r===void 0||r==="")return;let e=parseFloat(r);return Number.isNaN(e)?void 0:e}function mo(r){return r&&r.length>=6?`${r.slice(0,2)}:${r.slice(2,4)}:${r.slice(4,6)}`:void 0}var go=new Map;function wo(r,e){let t=e.trim();if(!t.startsWith("$")||!Xa(t))return;let s=t.slice(1,t.lastIndexOf("*")>=0?t.lastIndexOf("*"):void 0).split(","),n=s[0].length>=5?s[0].slice(-3):s[0];switch(n){case"GGA":{let o=parseInt(s[6]||"0",10);r.fixQuality=Number.isNaN(o)?0:o,r.utcTime=mo(s[1])??r.utcTime,r.satellites=pe(s[7]),r.hdop=pe(s[8])??r.hdop,r.fixQuality>0&&(r.lat=Qi(s[2],s[3])??r.lat,r.lon=Qi(s[4],s[5])??r.lon,r.alt=pe(s[9])??r.alt);break}case"RMC":{if(r.utcTime=mo(s[1])??r.utcTime,s[9]&&s[9].length===6&&(r.utcDate=`${s[9].slice(0,2)}/${s[9].slice(2,4)}/${s[9].slice(4,6)}`),s[2]==="A"){r.lat=Qi(s[3],s[4])??r.lat,r.lon=Qi(s[5],s[6])??r.lon;let o=pe(s[7]);o!==void 0&&(r.speedKmh=o*1.852),r.headingDeg=pe(s[8])??r.headingDeg,r.fixQuality||(r.fixQuality=1)}break}case"VTG":{let o=pe(s[7]);o!==void 0&&(r.speedKmh=o),r.headingDeg=pe(s[1])??r.headingDeg;break}case"GSA":{let o=parseInt(s[2]||"1",10);r.fixMode=o===3?"3D":o===2?"2D":"No fix",r.pdop=pe(s[15])??r.pdop,r.hdop=pe(s[16])??r.hdop,r.vdop=pe(s[17])??r.vdop;break}case"GSV":{let o=pe(s[3]);if(o!==void 0){let a=s[0].slice(0,2);go.set(a,o);let l=0;for(let c of go.values())l+=c;r.satellitesInView=l}break}default:return}return r.lastSentence=t,n}var Xi=class{constructor(){this.buf=""}push(e){this.buf+=e;let t=this.buf.split(/\r?\n/);return this.buf=t.pop()??"",this.buf.length>4096&&(this.buf=""),t}};var xo=new Map([["off","Off"],["phone","Phone / device GPS"],["gmouse","G-MOUSE USB GPS (NMEA)"]]),yo=[9600,4800,38400,115200],Ya=2500,dr="webrx.gps.source",vo=15e3;function fr(){if(typeof navigator>"u")return!1;let r=navigator.userAgentData;return r&&typeof r.mobile=="boolean"?r.mobile:/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)}function ur(){return typeof navigator<"u"&&"serial"in navigator}function Ja(){return typeof navigator<"u"&&"geolocation"in navigator}function el(){return fr()?"phone":ur()?"gmouse":"phone"}var pr=class extends EventTarget{constructor(){super(...arguments);this._status={source:"off",state:"off"};this.watchId=null;this.port=null;this.reader=null;this.session=0;this.staleTimer=null}get status(){return this._status}get fix(){return this._status.fix}savedSource(){try{let t=localStorage.getItem(dr);if(t==="off"||t==="phone"||t==="gmouse")return t}catch{}return el()}async start(t,i){await this.stop();try{localStorage.setItem(dr,t)}catch{}if(t==="off")return;if(t==="phone")return this.startPhone();let s,n=new Promise(o=>s=o);return this.startGMouse(i?.pickPort??!0,s).catch(o=>this.update({source:"gmouse",state:"error",message:String(o)})).finally(()=>s()),n}hasSavedChoice(){try{return localStorage.getItem(dr)!==null}catch{return!1}}async resume(){let t=this.savedSource();if(t==="phone")return this.start("phone");if(t==="gmouse"&&ur()){if((await navigator.serial.getPorts()).length>0)return this.start("gmouse",{pickPort:!1});this.update({source:"gmouse",state:"off",message:"Press \u201CConnect GPS\u201D to pick the G-MOUSE port"})}}async stop(){if(++this.session,this.watchId!==null&&(navigator.geolocation.clearWatch(this.watchId),this.watchId=null),this.reader){try{await this.reader.cancel(),this.reader.releaseLock()}catch{}this.reader=null}if(this.port){try{await this.port.close()}catch{}this.port=null}this.staleTimer!==null&&clearInterval(this.staleTimer),this.staleTimer=null,this.update({source:"off",state:"off"})}startPhone(){if(!Ja()){this.update({source:"phone",state:"error",message:"This browser has no Geolocation API"});return}this.update({source:"phone",state:"searching",message:"Waiting for location permission / first fix"}),this.watchId=navigator.geolocation.watchPosition(t=>{let i=t.coords;this.setFix({source:"phone",lat:i.latitude,lon:i.longitude,altM:i.altitude??void 0,speedKmh:i.speed!==null&&i.speed!==void 0?i.speed*3.6:void 0,headingDeg:i.heading!==null&&!Number.isNaN(i.heading)?i.heading??void 0:void 0,accuracyM:i.accuracy,fixLabel:i.accuracy<=20?"GPS":i.accuracy<=100?"Approximate":"Coarse",timestamp:t.timestamp||Date.now()})},t=>{let i=this._status.fix;if(t.code!==1&&i&&Date.now()-i.timestamp<vo)return;let s=t.code===1?"Location permission denied \u2014 allow it in the browser's site settings":t.code===2?"Position unavailable \u2014 turn on location services":"Timed out waiting for a fix \u2014 move to open sky",n=t.code===1?"error":"searching";this._status.state===n&&this._status.message===s||this.update({...this._status,source:"phone",state:n,message:s})},{enableHighAccuracy:!0,maximumAge:2e3,timeout:3e4}),this.watchStale()}async startGMouse(t,i){if(!ur()){this.update({source:"gmouse",state:"error",message:"Web Serial isn't available here \u2014 use Chrome or Edge on a computer, or choose phone GPS"});return}let s=navigator.serial,n=this.session;this.update({source:"gmouse",state:"connecting",message:"Choose the G-MOUSE serial port"});let o;try{let a=await s.getPorts();o=!t&&a.length>0?a[0]:await s.requestPort()}catch{this.update({source:"gmouse",state:"off",message:"No serial port selected"});return}if(n===this.session){this.port=o,this.watchStale(),i();for(let a=0;n===this.session;a=(a+1)%yo.length){let l=yo[a];this.update({...this._status,source:"gmouse",state:this._status.fix?"fix":"connecting",baud:l,message:`Listening at ${l} baud\u2026`});let c=await this.readPort(o,l,n);if(c==="stopped")return;if(c==="error"){this.update({source:"gmouse",state:"error",message:"The GPS was disconnected or the port is in use by another program"});return}}}}async readPort(t,i,s){try{await t.open({baudRate:i})}catch{return"error"}let n={},o=new Xi,a=new TextDecoder,l=0,c=t.readable.getReader();this.reader=c;let d,u=new Promise(f=>{d=setTimeout(()=>f(null),Ya)}),m=null;try{for(;s===this.session;){m||(m=c.read());let f=l===0?await Promise.race([m,u]):await m;if(f===null){await c.cancel().catch(()=>{});try{c.releaseLock()}catch{}return this.reader=null,await t.close().catch(()=>{}),"silent"}if(m=null,f.done)break;for(let $ of o.push(a.decode(f.value,{stream:!0})))wo(n,$)&&(++l,this.onNmea(n,i))}}catch{return s!==this.session?"stopped":"error"}finally{clearTimeout(d);try{c.releaseLock()}catch{}}return s===this.session?"error":"stopped"}onNmea(t,i){let s=t.fixQuality??0;s>0&&t.lat!==void 0&&t.lon!==void 0?this.setFix({source:"gmouse",lat:t.lat,lon:t.lon,altM:t.alt,speedKmh:t.speedKmh,headingDeg:t.headingDeg,hdop:t.hdop,accuracyM:t.hdop!==void 0?t.hdop*2.5:void 0,satellites:t.satellites,satellitesInView:t.satellitesInView,fixLabel:`${bo[s]??"Fix"}${t.fixMode&&t.fixMode!=="No fix"?" "+t.fixMode:""}`,timestamp:Date.now(),utcTime:t.utcTime,nmea:t.lastSentence},i):this.update({source:"gmouse",state:"searching",baud:i,satellitesInView:t.satellitesInView,fix:this._status.fix,message:`Receiving NMEA at ${i} baud \u2014 acquiring satellites${t.satellitesInView?` (${t.satellitesInView} in view)`:""}`})}setFix(t,i){this.update({source:t.source,state:"fix",fix:t,baud:i,satellitesInView:t.satellitesInView})}watchStale(){this.staleTimer!==null&&clearInterval(this.staleTimer),this.staleTimer=setInterval(()=>{let t=this._status;t.state==="fix"&&t.fix&&Date.now()-t.fix.timestamp>vo&&this.update({...t,state:"searching",message:"Fix lost \u2014 last position kept"})},3e3)}update(t){this._status=t,this.dispatchEvent(new Event("change"))}},fe=new pr;function So(r,e=5){let t=r.lat>=0?"N":"S",i=r.lon>=0?"E":"W";return`${Math.abs(r.lat).toFixed(e)}\xB0 ${t}, ${Math.abs(r.lon).toFixed(e)}\xB0 ${i}`}var mr="webrx.compass.enabled";function tl(r){return["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round((r%360+360)%360/22.5)%16]}function il(r,e,t){let i=Math.PI/180,s=e*i,n=t*i,o=r*i,a=Math.cos(s),l=Math.cos(n),c=Math.cos(o),d=Math.sin(s),u=Math.sin(n),m=Math.sin(o),f=-c*u-m*d*l,$=-m*u+c*d*l,q=Math.atan2(f,$);return q<0&&(q+=2*Math.PI),((Math.abs(e)<25&&Math.abs(t)<25?360-r:q*180/Math.PI)%360+360)%360}function Ro(){if(typeof screen<"u"&&screen.orientation&&typeof screen.orientation.angle=="number")return screen.orientation.angle;let r=typeof window<"u"?window.orientation:0;return typeof r=="number"?r:0}function sl(){return typeof window<"u"&&("ondeviceorientationabsolute"in window||"DeviceOrientationEvent"in window)}var gr=class extends EventTarget{constructor(){super(...arguments);this._status={state:"off"};this.sx=0;this.sy=0;this.primed=!1;this.lastEmit=0;this.watchdog=null;this.onAbsolute=t=>this.handle(t,"absolute");this.onRelative=t=>this.handle(t,"relative")}get status(){return this._status}wasEnabled(){try{return localStorage.getItem(mr)!=="0"}catch{return!0}}needsPermissionTap(){let t=window.DeviceOrientationEvent;return!!t&&typeof t.requestPermission=="function"}async start(){try{localStorage.setItem(mr,"1")}catch{}if(!sl()){this.update({state:"unavailable",message:"No compass in this browser"});return}let t=window.DeviceOrientationEvent;if(t&&typeof t.requestPermission=="function")try{if(await t.requestPermission()!=="granted"){this.update({state:"denied",message:"Motion & orientation access was not allowed"});return}}catch{this.update({state:"denied",message:"Tap the compass button to allow motion & orientation access"});return}this.stopListening(),this.primed=!1,this.update({state:"starting",message:"Waiting for the compass sensor\u2026"}),"ondeviceorientationabsolute"in window&&window.addEventListener("deviceorientationabsolute",this.onAbsolute),window.addEventListener("deviceorientation",this.onRelative),this.watchdog=setTimeout(()=>{this._status.state==="starting"&&this.update({state:"unavailable",message:"No compass sensor on this device"})},3e3)}stop(){try{localStorage.setItem(mr,"0")}catch{}this.stopListening(),this.update({state:"off"})}stopListening(){window.removeEventListener("deviceorientationabsolute",this.onAbsolute),window.removeEventListener("deviceorientation",this.onRelative),this.watchdog!==null&&clearTimeout(this.watchdog),this.watchdog=null}handle(t,i){let s=t.webkitCompassHeading,n,o,a;if(typeof s=="number"&&!Number.isNaN(s)){n=(s+Ro())%360,o="ios";let m=t.webkitCompassAccuracy;typeof m=="number"&&m>=0&&(a=m)}else if(t.alpha!==null&&t.beta!==null&&t.gamma!==null){if(i==="relative"&&!t.absolute&&"ondeviceorientationabsolute"in window)return;n=(il(t.alpha,t.beta,t.gamma)+Ro())%360,o=i==="absolute"||t.absolute?"absolute":"relative"}else return;let l=n*Math.PI/180,c=this.primed?.25:1;this.sx=this.sx*(1-c)+Math.sin(l)*c,this.sy=this.sy*(1-c)+Math.cos(l)*c,this.primed=!0;let d=(Math.atan2(this.sx,this.sy)*180/Math.PI+360)%360,u=Date.now();if(this.watchdog!==null&&(clearTimeout(this.watchdog),this.watchdog=null),u-this.lastEmit<80&&this._status.state==="on"){this._status={...this._status,heading:d,timestamp:u};return}this.lastEmit=u,this.update({state:"on",heading:d,accuracy:a,source:o,timestamp:u,message:o==="relative"?"No north reference: heading is relative":void 0})}update(t){this._status=t,this.dispatchEvent(new Event("change"))}},me=new gr;function Yi(r){return r===void 0||Number.isNaN(r)?"\u2014":`${Math.round(r)%360}\xB0 ${tl(r)}`}var rl=(()=>{let r=new Set([256e3]);for(let e=1024e3;e<3e6;e+=256e3)r.add(e);for(let e=96e4;e<3e6;e+=192e3)r.add(e);return[...r].sort((e,t)=>e-t)})(),nl=[2e6,24e5,32e5,4e6,5e6,8e6,1e7,125e5,16e6,2e7];function _o(r){return r==="hackrf"?nl:rl}function Do(r){return r>=1e6?`${(r/1e6).toLocaleString(void 0,{maximumFractionDigits:3})} Msps`:`${(r/1e3).toLocaleString()} ksps`}var O=function(r,e,t,i){var s=arguments.length,n=s<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,t):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,e,t,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(e,t,n):o(e,t))||n);return s>3&&n&&Object.defineProperty(e,t,n),n},L=function(r,e){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,e)},$o;var ol=(()=>{let r=new Array;for(let e=32;e<=32768;e*=2)r.push(e);return r})(),al=new Map([["default","Default method"],["directSampling","Direct sampling"],["upconverter","External upconverter"]]),ll=new Map([["Q","Q"],["I","I"]]),hl=new Map([[50,"Europe"],[75,"USA"]]),cl=new Map([["cpu","Use more CPU"],["latency","Have more latency"],["quality","Have worse quality"]]),A=class extends ut(x){constructor(){super(...arguments),this.inline=!1,this.playing=!1,this.sampleRate=1024e3,this.ppm=0,this.fftSize=2048,this.fmDeemph=50,this.biasTee=!1,this.lowFrequencyMethod={name:"default",channel:"Q",frequency:1e8,biasTee:!1},this.performanceTradeoff="cpu",this.sdrKind="auto",this.hackrfAmp=!1,this.dspActive=!1,this.dspSimd=!1,this.wasmDsp=!0,this.gpsSource="off",this.gpsStatus={source:"off",state:"off"},this.canInstall=!1,this.compassStatus={state:"off"}}static get styles(){return[te,S`
        h3 {
          margin: 0.9em 0 0.35em;
          font-size: 0.78em;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.7;
        }
        h3:first-child {
          margin-top: 0.2em;
        }
        .note {
          font-size: 0.85em;
          opacity: 0.75;
          max-width: 34ch;
        }
        .ok {
          color: #16a34a;
        }
        .warn {
          color: #d97706;
        }
        .err {
          color: #dc2626;
        }
        @media (prefers-color-scheme: dark) {
          .ok {
            color: #4ade80;
          }
          .warn {
            color: #fbbf24;
          }
          .err {
            color: #f87171;
          }
        }
        .row {
          display: flex;
          gap: 0.5em;
          align-items: center;
          flex-wrap: wrap;
        }
      `]}effectiveKind(){return this.connectedSdr?.kind??(this.sdrKind==="hackrf"?"hackrf":"rtlsdr")}renderDevice(){let e=this.connectedSdr;return p`<h3>Device</h3>
      <div>
        <label for="sdrKind">SDR: </label
        ><select id="sdrKind" .disabled=${this.playing} @change=${this.onSdrKindChange}>
          ${[...fo.entries()].map(([t,i])=>p`<option value=${t} .selected=${this.sdrKind==t}>${i}</option>`)}
        </select>
      </div>
      <div class="note">
        ${e?p`<span class="ok">●</span> ${e.name}${e.detail?p` · ${e.detail}`:g}`:p`Press ▶ to choose a device. RTL-SDR on Windows needs the WinUSB driver
              (Zadig); HackRF works without extra drivers.`}
      </div>
      <div class="row">
        <button id="chooseDevice" .disabled=${this.playing} @click=${this.onChooseDevice}>
          Use a different device…
        </button>
      </div>
      <div .hidden=${this.effectiveKind()!="hackrf"}>
        <label for="hackrfAmp">HackRF RF amp (+14 dB): </label
        ><input
          type="checkbox"
          id="hackrfAmp"
          .checked=${this.hackrfAmp}
          @change=${this.onHackrfAmpChange}
        />
      </div>`}renderGps(){let e=this.gpsStatus,t=e.state==="fix"?"ok":e.state==="error"?"err":e.state==="off"?"":"warn";return p`<h3>Location</h3>
      <div class="row">
        <label for="gpsSource">GPS: </label
        ><select id="gpsSource" @change=${this.onGpsSourceChange}>
          ${[...xo.entries()].map(([i,s])=>p`<option value=${i} .selected=${this.gpsSource==i}>${s}</option>`)}
        </select>
        <button id="gpsConnect" .hidden=${this.gpsSource=="off"} @click=${this.onGpsConnect}>
          ${this.gpsSource=="gmouse"?"Connect GPS\u2026":"Start"}
        </button>
      </div>
      <div class="note">
        <span class=${t}>●</span>
        ${e.fix?p`${So(e.fix)}
              ${e.fix.accuracyM!==void 0?p` ±${e.fix.accuracyM.toFixed(0)} m`:g}
              ${e.fix.satellites!==void 0?p` · ${e.fix.satellites} sats`:g}`:e.message??(e.state==="off"?"Off":e.state)}
      </div>
      <div class="row">
        <label>Compass: </label>
        <span class=${this.compassStatus.state==="on"?"ok":this.compassStatus.state==="off"?"":"warn"}
          >${this.compassStatus.state==="on"?Yi(this.compassStatus.heading):this.compassStatus.message??(this.compassStatus.state==="off"?"Off":this.compassStatus.state)}</span
        >
        <button id="compassToggle" @click=${this.onCompassToggle}>
          ${this.compassStatus.state==="on"||this.compassStatus.state==="starting"?"Turn off":"Turn on"}
        </button>
      </div>`}renderEngine(){return p`<h3>Performance</h3>
      <div class="note">
        DSP engine:
        ${this.dspActive?p`<span class="ok">Rust/WebAssembly${this.dspSimd?" (SIMD)":""}</span>`:p`<span class="warn">JavaScript</span>`}
      </div>
      <div>
        <label for="wasmDsp">Use Rust/WASM DSP: </label
        ><input
          type="checkbox"
          id="wasmDsp"
          .checked=${this.wasmDsp}
          @change=${this.onWasmDspChange}
        />
      </div>`}render(){return p`<rr-window
      label="Settings"
      id="settings"
      closeable
      class=${this.inline?"inline":""}
      .position=${this.position}
      .fixed=${this.inline}
    >
      ${this.renderDevice()}
      <h3>Radio</h3>
      <div>
        <label for="sampleRate">Sample rate: </label
        ><select
          id="sampleRate"
          .disabled=${this.playing}
          @change=${this.onSampleRateChange}
        >
          ${(()=>{let e=_o(this.effectiveKind());return(e.includes(this.sampleRate)?e:[...e,this.sampleRate].sort((i,s)=>i-s)).map(i=>p`<option value=${i} .selected=${this.sampleRate==i}>
                  ${Do(i)}
                </option>`)})()}
        </select>
      </div>
      <div>
        <label for="ppm">Clock correction: </label
        ><input
          id="ppm"
          type="number"
          min="-500"
          max="500"
          step="1"
          .value=${String(this.ppm)}
          @change=${this.onPpmChange}
        />PPM
      </div>
      <div>
        <label for="fftSize">FFT size: </label
        ><select id="fftSize" @change=${this.onFftSizeChange}>
          ${ol.map(e=>p`<option value=${e} .selected=${this.fftSize==e}>
                ${e}
              </option>`)}
        </select>
      </div>
      <div>
        <label for="fmDeemph">WBFM de-emphasis: </label
        ><select
          id="fmDeemph"
          .disabled=${this.playing}
          @change=${this.onFmDeemphChange}
        >
          ${hl.entries().map(e=>p`<option value=${e[0]} .selected=${this.fmDeemph==e[0]}>
                ${e[0]}µs &mdash; ${e[1]}
              </option>`)}
        </select>
      </div>
      <div>
        <label for="biasTee">Bias T: </label
        ><input
          type="checkbox"
          id="biasTee"
          .checked=${this.biasTee}
          @change=${this.onBiasTeeChange}
        />
      </div>
      <div .hidden=${this.effectiveKind()=="hackrf"}>
        <label for="lowFreqMethod">0-29MHz method: </label
        ><select id="lowFreqMethod" @change=${this.onLowFrequencyMethodChange}>
          ${al.entries().map(([e,t])=>p`<option
                value=${String(e)}
                .selected=${this.lowFrequencyMethod.name==e}
              >
                ${t}
              </option>`)}
        </select>
      </div>
      <div .hidden=${this.lowFrequencyMethod.name!="directSampling"||this.effectiveKind()=="hackrf"}>
        <label for="directSamplingChannel">Direct sampling channel: </label
        ><select
          id="directSamplingChannel"
          @change=${this.onDirectSamplingChannelChange}
        >
          ${ll.entries().map(([e,t])=>p`<option
                value=${String(e)}
                .selected=${this.lowFrequencyMethod.channel==e}
              >
                ${t}
              </option>`)}
        </select>
      </div>
      <div .hidden=${this.lowFrequencyMethod.name!="upconverter"}>
        <label for="upconverterFrequency">Upconverter frequency: </label
        ><input
          type="number"
          id="upconverterFrequency"
          min="1"
          max="1800000000"
          step="1"
          .value=${String(this.lowFrequencyMethod.frequency)}
          @change=${this.onUpconverterFrequencyChange}
        />
      </div>
      <div .hidden=${this.lowFrequencyMethod.name!="upconverter"}>
        <label for="upconverterBiasTee">Use bias T for upconverter: </label
        ><input
          type="checkbox"
          id="upconverterBiasTee"
          .checked=${this.lowFrequencyMethod.biasTee}
          @change=${this.onUpconverterBiasTeeChange}
        />
      </div>
      <div>
        <label for="performanceTradeoff">Performance trade-off: </label
        ><select
          id="performanceTradeoff"
          .disabled=${this.playing}
          @change=${this.onPerformanceTradeoffChange}
        >
          ${cl.entries().map(e=>p`<option
                value=${e[0]}
                .selected=${this.performanceTradeoff==e[0]}
              >
                ${e[1]}
              </option>`)}
        </select>
      </div>
      ${this.renderEngine()} ${this.renderGps()}
      ${this.canInstall?p`<h3>App</h3>
            <button id="install" @click=${this.onInstall}>Install webRx as an app</button>`:g}
    </rr-window>`}onSdrKindChange(e){this.sdrKind=e.target.selectedOptions[0].value,this.dispatchEvent(new Re("rr-sdr-kind-changed"))}onChooseDevice(){this.dispatchEvent(new Re("rr-choose-device"))}onHackrfAmpChange(e){this.hackrfAmp=e.target.checked,this.dispatchEvent(new Re("rr-hackrf-amp-changed"))}onWasmDspChange(e){this.wasmDsp=e.target.checked,this.dispatchEvent(new Re("rr-wasm-dsp-changed"))}onGpsSourceChange(e){this.gpsSource=e.target.selectedOptions[0].value,this.dispatchEvent(new Re("rr-gps-source-changed"))}onGpsConnect(){this.dispatchEvent(new Re("rr-gps-connect"))}onCompassToggle(){this.dispatchEvent(new Re("rr-compass-toggle"))}onInstall(){this.dispatchEvent(new Re("rr-install-app"))}onSampleRateChange(e){this.sampleRate=Number(e.target.selectedOptions[0].value),this.dispatchEvent(new br)}onPpmChange(e){let t=e.target,i=Number(t.value);if(isNaN(i)){t.value=String(this.ppm);return}this.ppm=i,this.dispatchEvent(new wr)}onFftSizeChange(e){this.fftSize=Number(e.target.selectedOptions[0].value),this.dispatchEvent(new yr)}onFmDeemphChange(e){this.fmDeemph=Number(e.target.selectedOptions[0].value),this.dispatchEvent(new vr)}onBiasTeeChange(e){this.biasTee=e.target.checked,this.dispatchEvent(new xr)}onLowFrequencyMethodChange(e){let t={...this.lowFrequencyMethod};t.name=e.target.selectedOptions[0].value,this.lowFrequencyMethod=t,this.dispatchEvent(new gt)}onDirectSamplingChannelChange(e){let t={...this.lowFrequencyMethod};t.channel=e.target.selectedOptions[0].value,this.lowFrequencyMethod=t,this.dispatchEvent(new gt)}onUpconverterFrequencyChange(e){let t=e.target,i=Number(t.value);if(isNaN(i)){t.value=String(this.lowFrequencyMethod.frequency);return}let s={...this.lowFrequencyMethod};s.frequency=i,this.lowFrequencyMethod=s,this.dispatchEvent(new gt)}onUpconverterBiasTeeChange(e){let t={...this.lowFrequencyMethod};t.biasTee=e.target.checked,this.lowFrequencyMethod=t,this.dispatchEvent(new gt)}onPerformanceTradeoffChange(e){this.performanceTradeoff=e.target.selectedOptions[0].value,this.dispatchEvent(new Sr)}};O([h({attribute:!1}),L("design:type",Boolean)],A.prototype,"inline",void 0);O([h({attribute:!1}),L("design:type",Boolean)],A.prototype,"playing",void 0);O([h({attribute:!1}),L("design:type",Number)],A.prototype,"sampleRate",void 0);O([h({attribute:!1}),L("design:type",Number)],A.prototype,"ppm",void 0);O([h({attribute:!1}),L("design:type",Number)],A.prototype,"fftSize",void 0);O([h({attribute:!1}),L("design:type",Number)],A.prototype,"fmDeemph",void 0);O([h({attribute:!1}),L("design:type",Boolean)],A.prototype,"biasTee",void 0);O([h({attribute:!1}),L("design:type",Object)],A.prototype,"lowFrequencyMethod",void 0);O([h({attribute:!1}),L("design:type",String)],A.prototype,"performanceTradeoff",void 0);O([h({attribute:!1}),L("design:type",Object)],A.prototype,"sdrKind",void 0);O([h({attribute:!1}),L("design:type",Object)],A.prototype,"connectedSdr",void 0);O([h({attribute:!1}),L("design:type",Boolean)],A.prototype,"hackrfAmp",void 0);O([h({attribute:!1}),L("design:type",Boolean)],A.prototype,"dspActive",void 0);O([h({attribute:!1}),L("design:type",Boolean)],A.prototype,"dspSimd",void 0);O([h({attribute:!1}),L("design:type",Boolean)],A.prototype,"wasmDsp",void 0);O([h({attribute:!1}),L("design:type",Object)],A.prototype,"gpsSource",void 0);O([h({attribute:!1}),L("design:type",Object)],A.prototype,"gpsStatus",void 0);O([h({attribute:!1}),L("design:type",Boolean)],A.prototype,"canInstall",void 0);O([h({attribute:!1}),L("design:type",Object)],A.prototype,"compassStatus",void 0);O([R("rr-window"),L("design:type",typeof($o=typeof N<"u"&&N)=="function"?$o:Object)],A.prototype,"window",void 0);A=O([D("rr-settings")],A);var Re=class extends Event{constructor(e){super(e,{bubbles:!0,composed:!0})}},br=class extends Event{constructor(){super("rr-sample-rate-changed",{bubbles:!0,composed:!0})}},wr=class extends Event{constructor(){super("rr-ppm-changed",{bubbles:!0,composed:!0})}},yr=class extends Event{constructor(){super("rr-fft-size-changed",{bubbles:!0,composed:!0})}},vr=class extends Event{constructor(){super("rr-fm-deemph-changed",{bubbles:!0,composed:!0})}},xr=class extends Event{constructor(){super("rr-bias-tee-changed",{bubbles:!0,composed:!0})}},gt=class extends Event{constructor(){super("rr-low-frequency-method-changed",{bubbles:!0,composed:!0})}},Sr=class extends Event{constructor(){super("rr-performance-tradeoff-changed",{bubbles:!0,composed:!0})}};var bt=class extends CustomEvent{constructor(e){super("spectrum-tap",{detail:e,bubbles:!0,composed:!0})}},tt=class extends CustomEvent{constructor(e){super("spectrum-drag",{detail:e,bubbles:!0,composed:!0})}},Ji=class extends CustomEvent{constructor(e){super("spectrum-highlight-changed",{detail:e,bubbles:!0,composed:!0})}},it=class extends CustomEvent{constructor(e){super("spectrum-zoom",{detail:e,bubbles:!0,composed:!0})}},Gt=class extends CustomEvent{constructor(e){super("spectrum-decibel-range-changed",{detail:e,bubbles:!0,composed:!0})}};var se=class{constructor(e,t,i,s,n){this.width=t;this.bins=i;this.centerFreq=s;this.bandwidth=n;this.leftBin=Math.floor(e.leftFraction*i),this.visibleBins=Math.floor(e.spanFraction*i),this.leftFrequency=this.binNumberToFrequency(this.leftBin-.5),this.rightFrequency=this.binNumberToFrequency(this.leftBin+this.visibleBins-.5)}zoomed(e){return(e*this.bins-this.leftBin+.5)/this.visibleBins}unzoomed(e){return(this.leftBin+this.visibleBins*e-.5)/this.bins}screenBinToFftBin(e){return(e+this.bins/2)%this.bins}leftCoordToBinNumber(e){return Math.round(this.leftBin+e*this.visibleBins/this.width)}binNumberToCenterCoord(e){return this.width*(e+.5-this.leftBin)/this.visibleBins}binNumberToFrequency(e){return this.centerFreq&&this.bandwidth?this.centerFreq+this.bandwidth*(e/this.bins-.5):this.centerFreq||0}};var Fo=1,Mo=16,C=class r{constructor(e,t){e===void 0&&(e=1),t===void 0&&(t=.5),e<Fo&&(e=Fo),e>Mo&&(e=Mo);let i=1/(2*e);t-i<0&&(t=i),t+i>1&&(t=1-i),this.center=t,this.level=e}zoomed(e){return .5+this.level*(e-this.center)}unzoomed(e){return this.center+(e-.5)/this.level}get leftFraction(){return this.center-1/(2*this.level)}get rightFraction(){return this.center+1/(2*this.level)}get spanFraction(){return 1/this.level}isVisible(e){let t=this.zoomed(e);return 0<=t&&t<1}withCenter(e){return new r(this.level,e)}withMovedCenter(e){return this.withCenter(this.center+e)}withLevel(e){return new r(e,this.center)}withLevelInContext(e,t){let i=this.zoomed(t);if(i<0||i>=1)return this.withLevel(e);let s=t+(.5-i)/e;return new r(e,s)}},K=new C;var wt=function(r,e,t,i){var s=arguments.length,n=s<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,t):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,e,t,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(e,t,n):o(e,t))||n);return s>3&&n&&Object.defineProperty(e,t,n),n},yt=function(r,e){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,e)},Co,Eo,_e=class extends x{static get styles(){return[S`
        #scope {
          color: var(--rr-scope-color, yellow);
          width: 100%;
          height: 100%;
        }
      `]}render(){return p`<canvas id="scope"></canvas>`}constructor(){super(),this.minDecibels=-100,this.maxDecibels=-30,this.fftSize=2048,this.zoom=K,this.spectrum=new Float32Array(this.fftSize),this.width=this.fftSize,this.addEventListener("click",e=>this.onClick(e))}addFloatSpectrum(e){this.fftSize!=e.length&&(this.fftSize=e.length,this.spectrum=new Float32Array(this.fftSize)),this.spectrum.set(e),this.redraw()}updated(e){super.updated(e),e.has("zoom")&&this.redraw()}redraw(){let e=this.getContext();if(!e)return;let t=e.canvas.offsetWidth,i=e.canvas.offsetHeight;e.canvas.width!=t&&(e.canvas.width=t),e.canvas.height!=i&&(e.canvas.height=i),this.width!=t&&(this.width=t);let s=this.minDecibels,n=this.maxDecibels,o=n-s,a=(1-i)/o;e.clearRect(0,0,e.canvas.width,e.canvas.height),e.strokeStyle=getComputedStyle(this.canvas).getPropertyValue("color"),e.beginPath();let l=new se(this.zoom,this.width,this.fftSize),c=d=>(this.spectrum[l.screenBinToFftBin(d)]-n)*a;if(l.visibleBins<=t){let d=u=>l.binNumberToCenterCoord(u);e.moveTo(d(l.leftBin-1),c(l.leftBin-1));for(let u=0;u<l.visibleBins+1;++u)e.lineTo(d(l.leftBin+u),c(l.leftBin+u))}else for(let d=0;d<t;++d){let u=l.leftCoordToBinNumber(d),m=l.leftCoordToBinNumber(d+1),f=c(u);for(let $=u+1;$<m;++$)f=Math.min(f,c($));d==0?e.moveTo(d,f):e.lineTo(d,f)}e.stroke()}onClick(e){let i=new se(this.zoom,this.width,this.fftSize).unzoomed(e.offsetX/this.offsetWidth);this.dispatchEvent(new bt({fraction:i,target:"scope"})),e.preventDefault()}getContext(){if(this.context)return this.context;if(this.canvas)return this.canvas.width=this.fftSize,this.canvas.height=this.maxDecibels-this.minDecibels,this.context=this.canvas.getContext("2d"),this.context}};wt([h({type:Number,reflect:!0,attribute:"min-decibels"}),yt("design:type",Number)],_e.prototype,"minDecibels",void 0);wt([h({type:Number,reflect:!0,attribute:"max-decibels"}),yt("design:type",Number)],_e.prototype,"maxDecibels",void 0);wt([h({type:Number,reflect:!0}),yt("design:type",Number)],_e.prototype,"fftSize",void 0);wt([h({attribute:!1}),yt("design:type",typeof(Co=typeof C<"u"&&C)=="function"?Co:Object)],_e.prototype,"zoom",void 0);wt([R("#scope"),yt("design:type",typeof(Eo=typeof HTMLCanvasElement<"u"&&HTMLCanvasElement)=="function"?Eo:Object)],_e.prototype,"canvas",void 0);_e=wt([D("rr-scope-line"),yt("design:paramtypes",[])],_e);var Ee=function(r,e,t,i){var s=arguments.length,n=s<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,t):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,e,t,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(e,t,n):o(e,t))||n);return s>3&&n&&Object.defineProperty(e,t,n),n},Pe=function(r,e){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,e)},Po,Ao,De=class extends x{static get styles(){return[S`
        canvas {
          color: var(--rr-captions-color, rgba(255, 255, 255, 0.5));
          width: 100%;
          height: 100%;
        }
      `]}render(){return p`<canvas id="canvas"></canvas>`}constructor(){super(),this.centerFrequency=0,this.frequencyScale=1,this.minDecibels=-100,this.maxDecibels=-30,this.fftSize=2048,this.zoom=K,this.resizeObserver=new ResizeObserver(()=>this.redraw())}connectedCallback(){super.connectedCallback(),this.resizeObserver?.disconnect(),this.resizeObserver.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.resizeObserver?.disconnect()}firstUpdated(e){super.firstUpdated(e),this.redraw()}updated(e){super.updated(e),!(e.size==0||e.size==1&&e.has("lines"))&&this.redraw()}redraw(){let e=this.getContext();if(!e)return;let t=e.canvas;t.width!=t.offsetWidth&&(t.width=this.offsetWidth),t.height!=t.offsetHeight&&(t.height=this.offsetHeight);let i=t.width,s=t.height,n=16,o=24,a=getComputedStyle(e.canvas).getPropertyValue("color"),l=this.computeLines(i-o,s-n);e.clearRect(0,0,i,s),e.save(),e.fillStyle=a;for(let{position:c,value:d,horizontal:u}of l){let[m,f]=[o+c*(i-o),n+c*(s-n)],$=String(u?d:d/(this.frequencyScale||1));if(u){e.textBaseline="middle",e.textAlign="right",m=o-2;let q=e.measureText($);f-q.actualBoundingBoxAscent<n&&(f=q.actualBoundingBoxAscent+n),f+q.actualBoundingBoxDescent>s&&(f=s-q.actualBoundingBoxDescent)}else{e.textBaseline="bottom",e.textAlign="center",f=n-2;let q=e.measureText($);m-q.actualBoundingBoxLeft<o&&(m=q.actualBoundingBoxLeft+o),m+q.actualBoundingBoxRight>i&&(m=i-q.actualBoundingBoxRight)}e.fillText($,m,f)}e.restore(),e.save(),e.strokeStyle=a,e.beginPath();for(let{position:c,horizontal:d}of l)if(d){let u=n+c*(s-n);e.moveTo(o,u),e.lineTo(i,u)}else{let u=o+c*(i-o);e.moveTo(u,n),e.lineTo(u,s)}e.stroke(),e.restore()}getContext(){if(this.context)return this.context;if(this.canvas)return this.context=this.canvas.getContext("2d"),this.context}computeLines(e,t){let i=[];if(this.minDecibels!==void 0&&this.maxDecibels!==void 0&&i.push(...qo(this.minDecibels,this.maxDecibels,20,25,t,Zt.Descending,Kt.Horizontal,[1,2,3,5,6,10])),this.bandwidth!==void 0){let s=new se(this.zoom,1,this.fftSize,this.centerFrequency,this.bandwidth);i.push(...qo(s.leftFrequency,s.rightFrequency,50,80,e,Zt.Ascending,Kt.Vertical))}else{let s=this.zoom.zoomed(.5);s>=0&&s<=1&&i.push({value:this.centerFrequency,position:s,horizontal:!1})}return i}};Ee([h({type:Number,reflect:!0}),Pe("design:type",Number)],De.prototype,"bandwidth",void 0);Ee([h({type:Number,reflect:!0,attribute:"center-frequency"}),Pe("design:type",Number)],De.prototype,"centerFrequency",void 0);Ee([h({type:Number,reflect:!0,attribute:"frequency-scale"}),Pe("design:type",Number)],De.prototype,"frequencyScale",void 0);Ee([h({type:Number,reflect:!0,attribute:"min-decibels"}),Pe("design:type",Number)],De.prototype,"minDecibels",void 0);Ee([h({type:Number,reflect:!0,attribute:"max-decibels"}),Pe("design:type",Number)],De.prototype,"maxDecibels",void 0);Ee([h({type:Number,reflect:!0}),Pe("design:type",Number)],De.prototype,"fftSize",void 0);Ee([h({attribute:!1}),Pe("design:type",typeof(Po=typeof C<"u"&&C)=="function"?Po:Object)],De.prototype,"zoom",void 0);Ee([R("#canvas"),Pe("design:type",typeof(Ao=typeof HTMLCanvasElement<"u"&&HTMLCanvasElement)=="function"?Ao:Object)],De.prototype,"canvas",void 0);De=Ee([D("rr-scope-background"),Pe("design:paramtypes",[])],De);var Zt;(function(r){r[r.Ascending=0]="Ascending",r[r.Descending=1]="Descending"})(Zt||(Zt={}));var Kt;(function(r){r[r.Horizontal=0]="Horizontal",r[r.Vertical=1]="Vertical"})(Kt||(Kt={}));function qo(r,e,t,i,s,n,o,a=[1,2,5,10]){let l=e-r,c=Math.pow(10,Math.floor(Math.log10(l/2))),d=Rr(t/s,i/s,l,c,a),u=o==Kt.Horizontal,m=[],f=r;for(f%d!=0&&(f+=d-f%d);f<=e;){let $=n==Zt.Ascending?(f-r)/l:(e-f)/l;m.push({position:$,value:f,horizontal:u}),f+=d}return m}function Rr(r,e,t,i,s){let n=t*r/i,o=t*e/i,a=(n+o)/2;if(o<s[0])return Rr(r,e,t,i/10,s);if(n>s[s.length-1])return Rr(r,e,t,i*10,s);let l=s[0],c=Math.abs(l-a),d=l>=n&&l<=o;for(let u=1;u<s.length;++u){let m=s[u]>=n&&s[u]<=o;if(d&&!m)continue;let f=Math.abs(s[u]-a);f<c&&(l=s[u],c=f,d=m)}return l*i}var Ae=function(r,e,t,i){var s=arguments.length,n=s<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,t):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,e,t,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(e,t,n):o(e,t))||n);return s>3&&n&&Object.defineProperty(e,t,n),n},We=function(r,e){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,e)},To,ko,oe=class extends x{constructor(){super(...arguments),this.centerFrequency=0,this.frequencyScale=1,this.minDecibels=-100,this.maxDecibels=-30,this.fftSize=2048,this.zoom=K}static get styles(){return[S`
        :host {
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          background: black;
          position: relative;

          --top-caption-margin: 16px;
          --left-caption-margin: 24px;
        }

        #container {
          position: relative;
          width: 100%;
          height: 100%;
        }

        #background {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }

        #line {
          position: absolute;
          top: var(--top-caption-margin);
          left: var(--left-caption-margin);
          width: calc(100% - var(--left-caption-margin));
          height: calc(100% - var(--top-caption-margin));
        }
      `]}render(){return p`<div id="container">
      <rr-scope-background
        id="background"
        .centerFrequency=${this.centerFrequency}
        .bandwidth=${this.bandwidth}
        .frequencyScale=${this.frequencyScale}
        .minDecibels=${this.minDecibels}
        .maxDecibels=${this.maxDecibels}
        .fftSize=${this.fftSize}
        .zoom=${this.zoom}
      ></rr-scope-background>
      <rr-scope-line
        id="line"
        .minDecibels=${this.minDecibels}
        .maxDecibels=${this.maxDecibels}
        .fftSize=${this.fftSize}
        .zoom=${this.zoom}
      ></rr-scope-line>
    </div> `}addFloatSpectrum(e){e.length!=this.fftSize&&(this.fftSize=e.length),this.line?.addFloatSpectrum(e)}};Ae([h({type:Number,reflect:!0}),We("design:type",Number)],oe.prototype,"bandwidth",void 0);Ae([h({type:Number,reflect:!0,attribute:"center-frequency"}),We("design:type",Number)],oe.prototype,"centerFrequency",void 0);Ae([h({type:Number,reflect:!0,attribute:"frequency-scale"}),We("design:type",Number)],oe.prototype,"frequencyScale",void 0);Ae([h({type:Number,reflect:!0,attribute:"min-decibels"}),We("design:type",Number)],oe.prototype,"minDecibels",void 0);Ae([h({type:Number,reflect:!0,attribute:"max-decibels"}),We("design:type",Number)],oe.prototype,"maxDecibels",void 0);Ae([h({type:Number,reflect:!0}),We("design:type",Number)],oe.prototype,"fftSize",void 0);Ae([h({attribute:!1}),We("design:type",typeof(To=typeof C<"u"&&C)=="function"?To:Object)],oe.prototype,"zoom",void 0);Ae([R("#line"),We("design:type",typeof(ko=typeof _e<"u"&&_e)=="function"?ko:Object)],oe.prototype,"line",void 0);oe=Ae([D("rr-scope")],oe);function dl(r,e,t,i){let s=new Array(256),n=s.length;for(let o=0;o<n;++o){let a=o/(n-1),l=Math.pow(a,i),c=2*Math.PI*(r/3+e*a),d=t*l*(1-l)/2,u=Math.cos(c),m=Math.sin(c),f=l+d*(-.14861*u+1.78277*m),$=l+d*(-.29227*u-.90649*m),q=l+d*1.97294*u;s[o]=[Math.floor(Math.max(0,Math.min(255,256*f))),Math.floor(Math.max(0,Math.min(255,256*$))),Math.floor(Math.max(0,Math.min(255,256*q)))]}return s}var vt=dl(2,1,3,1);function ul(){let r=[.13572138,4.6153926,-42.66032258,132.13108234,-152.94239396,59.28637943],e=[.09140261,2.19418839,4.84296658,-14.18503333,4.27729857,2.82956604],t=[.1066733,12.64194608,-60.58204836,110.36276771,-89.90310912,27.34824973],i=(o,a)=>o[0]*a[0]+o[1]*a[1]+o[2]*a[2]+o[3]*a[3]+o[4]*a[4]+o[5]*a[5],s=new Array(256),n=s.length;for(let o=0;o<n;++o){let a=o/255,l=[1,a,a*a,a*a*a,a*a*a*a,a*a*a*a*a];s[o]=[Math.floor(Math.max(0,Math.min(255,255*i(l,r)))),Math.floor(Math.max(0,Math.min(255,255*i(l,e)))),Math.floor(Math.max(0,Math.min(255,255*i(l,t))))]}return s}var fp=ul();var es=class{constructor(){this.palette=vt;this.images=[]}addFloatSpectrum(e,t,i,s,n){let o=e.length;if(this.prepareImageStack(o),s!==void 0&&n!==void 0){if(s!==this.frequency&&this.frequency!==void 0){let c=(s-this.frequency)/n;this.images.map(d=>d.scroll(c))}this.frequency=s}let a=this.images.map(c=>c.startRow(o,t,i)),l=o/2;for(let c=0;c<o;++c)a.map(d=>d.addBin(e[(c+l)%o]))}draw(e,t){let i=t.level*e.canvas.offsetWidth;(this.images.find(n=>n.width>=i)||this.images[this.images.length-1])?.draw(e,t)}prepareImageStack(e){let t=this.images[this.images.length-1];if((t?.width||0)==e)return;let s=[1024,2048,8192,32768].filter(a=>a<e);s.push(e);let n=0,o=0;for(;n<s.length||o<this.images.length;){let a=s[n],l=this.images[o]?.width;if(a===void 0||a>l){this.images.splice(o,1);continue}(l===void 0||a<l)&&this.images.splice(o,0,t?.resizeTo(a)||new _r(a,this.palette)),++n,++o}}},_r=class r{constructor(e,t){this.width=e;this.palette=t;this.scrollError=0;this.height=screen.height,this.data=new Uint8ClampedArray(4*this.width*(this.height+1)),this.xOffset=0,this.yOffset=0}startRow(e,t,i){return this.deltaY(-1),new Dr(this.data,(this.xOffset+this.yOffset*this.width)*4,e/this.width,t,i,this.palette)}draw(e,t){let i=new se(t,this.width,this.width);e.canvas.width!=i.visibleBins&&(e.canvas.width=i.visibleBins),e.canvas.height!=e.canvas.offsetHeight&&(e.canvas.height=e.canvas.offsetHeight);let s=Math.min(this.height-this.yOffset,e.canvas.height),n=(this.xOffset+this.yOffset*this.width)*4,o=n+s*this.width*4;e.putImageData(new ImageData(this.data.subarray(n,o),this.width),-i.leftBin,0);let a=e.canvas.height-s;if(a<=0)return;let l=(this.xOffset+a*this.width)*4;e.putImageData(new ImageData(this.data.subarray(this.xOffset*4,l),this.width),-i.leftBin,s)}scroll(e){if(e>=1||e<=-1){this.data.fill(0),this.xOffset=0,this.yOffset=0,this.scrollError=0;return}e+=this.scrollError;let t=Math.round(this.width*e);if(this.scrollError=e-t/this.width,t==0)return;this.deltaX(t);let i=t>0?-t:0,s=t>0?0:-t;for(let n=0;n<=this.height;++n){let o=n*this.width+this.xOffset;this.data.fill(0,(o+i)*4,(o+s)*4)}}resizeTo(e){let t=new OffscreenCanvas(this.width,this.height);t.getContext("2d").putImageData(new ImageData(this.data.subarray(this.xOffset*4,(this.xOffset+this.height*this.width)*4),this.width),0,0);let n=new OffscreenCanvas(e,this.height).getContext("2d");n.drawImage(t,0,0,e,this.height);let o=new r(e,this.palette);return o.data.set(n.getImageData(0,0,e,this.height).data),o.xOffset=0,o.yOffset=this.yOffset,o.scrollError=this.scrollError,o}deltaX(e){let t=this.xOffset+e,i=0;if(t<0){let s=this.height*this.width*4;for(this.data.copyWithin(s+this.xOffset*4,this.xOffset*4,this.width*4);t<0;)t+=this.width,i--}if(t>=this.width){let s=this.height*this.width*4;for(this.data.copyWithin(0,s,s+this.xOffset*4);t>=this.width;)t-=this.width,i++}this.xOffset=t,i!=0&&this.deltaY(i)}deltaY(e){let t=this.yOffset+e;for(;t<0;)t+=this.height;for(;t>=this.height;)t-=this.height;this.yOffset=t}},Dr=class{constructor(e,t,i,s,n,o){this.data=e;this.offset=t;this.ratio=i;this.palette=o;this.p=0;this.value=0;this.sub=s,this.mul=256/(n-s)}addBin(e){if((this.p==0||e>this.value)&&(this.value=e),this.p++,this.p<this.ratio)return;let t=Math.max(0,Math.min(255,Math.floor(this.mul*(this.value-this.sub)))),i=this.palette[isNaN(t)?0:t];this.data[this.offset++]=i[0],this.data[this.offset++]=i[1],this.data[this.offset++]=i[2],this.data[this.offset++]=255,this.p=0}};var qe=function(r,e,t,i){var s=arguments.length,n=s<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,t):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,e,t,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(e,t,n):o(e,t))||n);return s>3&&n&&Object.defineProperty(e,t,n),n},Te=function(r,e){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,e)},Bo,Io,ae=class extends x{static get styles(){return[S`
        #waterfall {
          width: 100%;
          height: 100%;
        }
      `]}render(){return p`<canvas id="waterfall"></canvas>`}constructor(){super(),this.minDecibels=-100,this.maxDecibels=-30,this.palette=vt,this.fftSize=2048,this.zoom=K,this.draggable=!1,this.image=new es,this.addEventListener("pointerdown",e=>this.onPointerDown(e))}firstUpdated(e){super.firstUpdated(e),this.dragController=new V(new $r(this))}updated(e){super.updated(e),e.has("zoom")&&this.redraw()}addFloatSpectrum(e,t){this.image.addFloatSpectrum(t,this.minDecibels,this.maxDecibels,e,this.bandwidth),this.redraw()}redraw(){let e=this.getContext();e&&this.image.draw(e,this.zoom)}getContext(){return this.context?this.context:this.canvas?(this.context=this.canvas.getContext("2d"),new ResizeObserver(()=>this.redraw()).observe(this.canvas),this.context):void 0}onPointerDown(e){this.draggable&&this.dragController?.startDragging(e)}};qe([h({type:Number,reflect:!0,attribute:"min-decibels"}),Te("design:type",Number)],ae.prototype,"minDecibels",void 0);qe([h({type:Number,reflect:!0,attribute:"max-decibels"}),Te("design:type",Number)],ae.prototype,"maxDecibels",void 0);qe([h({attribute:!1}),Te("design:type",Object)],ae.prototype,"palette",void 0);qe([h({type:Number,reflect:!0}),Te("design:type",Number)],ae.prototype,"fftSize",void 0);qe([h({attribute:!1}),Te("design:type",typeof(Bo=typeof C<"u"&&C)=="function"?Bo:Object)],ae.prototype,"zoom",void 0);qe([h({type:Number,reflect:!0}),Te("design:type",Number)],ae.prototype,"bandwidth",void 0);qe([h({type:Boolean,reflect:!0}),Te("design:type",Boolean)],ae.prototype,"draggable",void 0);qe([R("#waterfall"),Te("design:type",typeof(Io=typeof HTMLCanvasElement<"u"&&HTMLCanvasElement)=="function"?Io:Object)],ae.prototype,"canvas",void 0);ae=qe([D("rr-waterfall"),Te("design:paramtypes",[])],ae);var $r=class{constructor(e){this.waterfall=e,this.fraction=0}startDrag(){this.fraction=0,this.waterfall.dispatchEvent(new tt({fraction:0,target:"waterfall",operation:"start"}))}drag(e,t){this.fraction=e/(this.waterfall.clientWidth*this.waterfall.zoom.level),this.waterfall.dispatchEvent(new tt({fraction:this.fraction,target:"waterfall"}))}finishDrag(){this.waterfall.dispatchEvent(new tt({fraction:this.fraction,target:"waterfall",operation:"finish"}))}cancelDrag(){this.waterfall.dispatchEvent(new tt({fraction:0,target:"waterfall",operation:"cancel"}))}onClick(e){let i=new se(this.waterfall.zoom,this.waterfall.offsetWidth,this.waterfall.fftSize).unzoomed(e.offsetX/this.waterfall.offsetWidth);this.waterfall.dispatchEvent(new bt({fraction:i,target:"waterfall"})),e.preventDefault()}};var ke=function(r,e,t,i){var s=arguments.length,n=s<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,t):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,e,t,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(e,t,n):o(e,t))||n);return s>3&&n&&Object.defineProperty(e,t,n),n},He=function(r,e){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,e)},No,zo,Oo,Lo,Uo,$e=class extends x{constructor(){super(...arguments),this.minDecibels=-100,this.maxDecibels=-30,this.palette=vt}static get styles(){return[S`
        :host {
          position: relative;
          display: flex;
          flex-direction: row;
          align-items: stretch;
        }

        #palette {
          flex: 1;
          height: 24px;
          min-width: ${1.25*150}px;
        }

        @media (max-width: 375px) {
          #palette {
            min-width: ${150}px;
          }
        }

        #min,
        #max {
          width: 7ex;
          align-content: center;
        }

        #min {
          text-align: right;
          padding-right: 8px;
        }

        #max {
          text-align: left;
          padding-left: 8px;
        }

        #minThumb,
        #maxThumb {
          position: absolute;
          cursor: ew-resize;
          box-sizing: border-box;
          width: 8px;
          height: 24px;
          background: lightgray;
          border: 1px outset;
        }

        #minThumb {
          border-radius: 4px 0 0 4px;
        }

        #maxThumb {
          border-radius: 0 4px 4px 0;
        }

        .touchArea {
          position: absolute;
          top: -5px;
          bottom: -5px;
          left: -15px;
          right: -15px;
        }
      `]}render(){return p` <input
        id="min"
        type="text"
        .value=${xt(this.minDecibels)}
        @focus=${this.onMinFocus}
        @blur=${this.onMinBlur}
        @change=${this.onMinChange}
      />
      <canvas id="palette" width="256" height="24"></canvas>
      <input
        id="max"
        type="text"
        .value=${xt(this.maxDecibels)}
        @focus=${this.onMaxFocus}
        @blur=${this.onMaxBlur}
        @change=${this.onMaxChange}
      />
      <div id="minThumb" @pointerdown=${this.onMinPointerDown}>
        <div class="touchArea"></div>
      </div>
      <div id="maxThumb" @pointerdown=${this.onMaxPointerDown}>
        <div class="touchArea"></div>
      </div>`}firstUpdated(e){super.firstUpdated(e),this.minDragController=new V(new ts("min",this,this.paletteBox),0),this.maxDragController=new V(new ts("max",this,this.paletteBox),0),new ResizeObserver(()=>this.repaintPalette()).observe(document.body),this.repaintPalette()}updated(e){super.updated(e),this.repaintPalette()}repaintPalette(){let e=this.getContext();if(e){for(let t=0;t<e.canvas.width;++t){let s=255*(t*150/255+-150-this.minDecibels)/(this.maxDecibels-this.minDecibels);s<0&&(s=0),s>255&&(s=255),s=Math.floor(s),e.fillStyle=Fr(this.palette[s]),e.fillRect(t,0,1,24)}this.minBox&&(this.minBox.style.backgroundColor=Fr(this.palette[0]),this.minBox.style.color=Wo(this.palette[0])?"white":"black"),this.maxBox&&(this.maxBox.style.backgroundColor=Fr(this.palette[255]),this.maxBox.style.color=Wo(this.palette[255])?"white":"black"),this.minThumb&&this.paletteBox&&(this.minThumb.style.right=(this.minDecibels-0)*this.paletteBox.offsetWidth/-150+this.paletteBox.offsetLeft+"px"),this.maxThumb&&this.paletteBox&&(this.maxThumb.style.left=(this.maxDecibels- -150)*this.paletteBox.offsetWidth/150+this.paletteBox.offsetLeft+"px")}}getContext(){if(this.context)return this.context;if(this.paletteBox)return this.context=this.paletteBox.getContext("2d"),this.context}onMinFocus(e){let t=e.target;t.value=Mr(this.minDecibels)}onMinBlur(e){let t=e.target;t.value=xt(this.minDecibels)}onMinChange(e){let t=e.target,i=t.value;i.endsWith("dB")&&(i=i.substring(0,i.length-2).trim());let s=Number(i);isNaN(s)?t.value=xt(this.minDecibels):Ho(s,this)}onMaxFocus(e){let t=e.target;t.value=Mr(this.maxDecibels)}onMaxBlur(e){let t=e.target;t.value=xt(this.maxDecibels)}onMaxChange(e){let t=e.target,i=t.value;i.endsWith("dB")&&(i=i.substring(0,i.length-2).trim());let s=Number(i);isNaN(s)?t.value=xt(this.maxDecibels):jo(s,this)}onMinPointerDown(e){this.minDragController?.startDragging(e)}onMaxPointerDown(e){this.maxDragController?.startDragging(e)}};ke([h({type:Number,reflect:!0,attribute:"min-decibels"}),He("design:type",Number)],$e.prototype,"minDecibels",void 0);ke([h({type:Number,reflect:!0,attribute:"max-decibels"}),He("design:type",Number)],$e.prototype,"maxDecibels",void 0);ke([h({attribute:!1}),He("design:type",Object)],$e.prototype,"palette",void 0);ke([R("#min"),He("design:type",typeof(No=typeof HTMLElement<"u"&&HTMLElement)=="function"?No:Object)],$e.prototype,"minBox",void 0);ke([R("#max"),He("design:type",typeof(zo=typeof HTMLElement<"u"&&HTMLElement)=="function"?zo:Object)],$e.prototype,"maxBox",void 0);ke([R("#palette"),He("design:type",typeof(Oo=typeof HTMLCanvasElement<"u"&&HTMLCanvasElement)=="function"?Oo:Object)],$e.prototype,"paletteBox",void 0);ke([R("#minThumb"),He("design:type",typeof(Lo=typeof HTMLElement<"u"&&HTMLElement)=="function"?Lo:Object)],$e.prototype,"minThumb",void 0);ke([R("#maxThumb"),He("design:type",typeof(Uo=typeof HTMLElement<"u"&&HTMLElement)=="function"?Uo:Object)],$e.prototype,"maxThumb",void 0);$e=ke([D("rr-decibel-range")],$e);function Fr(r){return`rgb(${r[0]}, ${r[1]}, ${r[2]})`}function Wo(r){return Math.max(r[0],r[1],r[2])<96}var ts=class{constructor(e,t,i){this.type=e,this.range=t,this.box=i,this.startDb=0}startDrag(){this.startDb=this.type==="min"?this.range.minDecibels:this.range.maxDecibels}drag(e,t){let i=e/this.box.offsetWidth;this.changeDb(this.startDb+i*150)}finishDrag(){}cancelDrag(){this.changeDb(this.startDb)}onClick(){}changeDb(e){this.type=="min"?Ho(e,this.range):jo(e,this.range)}};function Ho(r,e){r=Math.round(r),r<-150&&(r=-150),r>0&&(r=0),r>e.maxDecibels-6&&(r=e.maxDecibels-6),e.minDecibels=r,e.dispatchEvent(new Gt({min:r}))}function jo(r,e){r=Math.round(r),r<-150&&(r=-150),r>0&&(r=0),r<e.minDecibels+6&&(r=e.minDecibels+6),e.maxDecibels=r,e.dispatchEvent(new Gt({max:r}))}function xt(r){return Mr(r)+" dB"}function Mr(r){return String(r)}var st=function(r,e,t,i){var s=arguments.length,n=s<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,t):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,e,t,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(e,t,n):o(e,t))||n);return s>3&&n&&Object.defineProperty(e,t,n),n},St=function(r,e){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,e)},Vo,je=class extends x{constructor(){super(...arguments),this.draggablePoint=!1,this.draggableLeft=!1,this.draggableRight=!1,this.fftSize=2048,this.zoom=K}static get styles(){return[S`
        :host {
          pointer-events: none;
        }

        .handle {
          pointer-events: all;
        }

        #point,
        #band,
        .handle {
          position: absolute;
          top: 0;
          bottom: 0;
        }

        #point {
          width: 2px;
          background: var(--rr-highlight-color, rgba(255, 255, 0, 0.25));
        }

        #band {
          background: var(--rr-highlight-area-color, rgba(255, 255, 255, 0.25));
        }

        .handle {
          width: 4px;
          cursor: ew-resize;
        }

        #pointHandle {
          cursor: col-resize;
        }

        #pointHandle:hover {
          background: var(--rr-highlight-handle-color, rgba(255, 255, 0, 1));
        }

        #leftBandHandle:hover,
        #rightBandHandle:hover {
          background: var(
            --rr-highlight-area-handle-color,
            rgba(255, 255, 255, 1)
          );
        }

        .touchArea {
          position: absolute;
          top: 0;
          bottom: 0;
          left: -10px;
          right: -10px;
        }
      `]}render(){return p`${this.renderBand()}${this.renderPoint()}`}renderPoint(){if(this.selection?.point===void 0)return g;let t=new se(this.zoom,this.offsetWidth,this.fftSize).zoomed(this.selection.point);return t<0||t>1?g:p`<div id="point" style="left:calc(${100*t}% - 1px)"></div>
      ${this.draggablePoint?p`<div
            id="pointHandle"
            class="handle"
            style="left:calc(${100*t}% - 2px)"
            @pointerdown=${this.onPointPointerDown}
          >
            <div class="touchArea"></div>
          </div>`:g}`}renderBand(){if(this.selection?.band===void 0)return g;let e=new se(this.zoom,this.offsetWidth,this.fftSize),t=e.zoomed(this.selection.band.left),i=e.zoomed(this.selection.band.right);if(t>1||i<0)return g;let s=Math.max(0,t),n=Math.min(i,1);return p`<div
        id="band"
        style="left:${100*s}%;width:${100*(n-s)}%"
      ></div>
      ${this.draggableLeft&&t==s?p`<div
            id="leftBandHandle"
            class="handle"
            style="left:calc(${100*t}% - 2px)"
            @pointerdown=${this.onLeftPointerDown}
          >
            <div class="touchArea"></div>
          </div>`:g}${this.draggableRight&&i==n?p`<div
            id="rightBandHandle"
            class="handle"
            style="left:calc(${100*i}% - 2px)"
            @pointerdown=${this.onRightPointerDown}
          >
            <div class="touchArea"></div>
          </div>`:g}`}firstUpdated(e){super.firstUpdated(e),this.pointDragController=new V(new Qt("point",this),0),this.leftDragController=new V(new Qt("start",this),0),this.rightDragController=new V(new Qt("end",this),0)}onPointPointerDown(e){this.pointDragController?.startDragging(e)}onLeftPointerDown(e){this.leftDragController?.startDragging(e)}onRightPointerDown(e){this.rightDragController?.startDragging(e)}};st([h({type:Boolean,reflect:!0,attribute:"draggable-point"}),St("design:type",Boolean)],je.prototype,"draggablePoint",void 0);st([h({type:Boolean,reflect:!0,attribute:"draggable-left"}),St("design:type",Boolean)],je.prototype,"draggableLeft",void 0);st([h({type:Boolean,reflect:!0,attribute:"draggable-right"}),St("design:type",Boolean)],je.prototype,"draggableRight",void 0);st([h({type:Number,reflect:!0}),St("design:type",Number)],je.prototype,"fftSize",void 0);st([h({attribute:!1}),St("design:type",typeof(Vo=typeof C<"u"&&C)=="function"?Vo:Object)],je.prototype,"zoom",void 0);st([h({attribute:!1}),St("design:type",Object)],je.prototype,"selection",void 0);je=st([D("rr-highlight")],je);var Qt=class{constructor(e,t){this.type=e,this.highlight=t}startDrag(){this.original=this.highlight.selection}drag(e,t){let i=this.highlight.zoom===void 0?1:this.highlight.zoom.level,s=this.getFraction();s!==void 0&&(s+=e/(this.highlight.offsetWidth*i),s<0&&(s=0),s>1&&(s=1),this.highlight.dispatchEvent(this.getEvent(s)))}finishDrag(){}cancelDrag(){let e=this.getFraction();e!==void 0&&this.highlight.dispatchEvent(this.getEvent(e))}onClick(){}getFraction(){return this.type=="point"?this.original?.point:this.type=="start"?this.original?.band?.left:this.original?.band?.right}getEvent(e){return new Ji(this.type=="point"?{fraction:e}:this.type=="start"?{startFraction:e}:{endFraction:e})}};var Er=function(r,e,t,i){var s=arguments.length,n=s<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,t):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,e,t,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(e,t,n):o(e,t))||n);return s>3&&n&&Object.defineProperty(e,t,n),n},Ko=function(r,e){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,e)},Go,Zo,is=class extends x{constructor(){super(...arguments),this.zoom=K}static get styles(){return[te,S`
        :host {
          display: flex;
          flex-direction: row;
          width: 100%;
        }

        #scroll {
          flex: 1;
          display: flex;
          flex-direction: row;
          border: solid ButtonBorder;
          border-width: 1px 0 1px 0;
        }

        #thumb {
          flex: 1;
        }

        #left,
        #right {
          background: color-mix(in srgb, ButtonFace, lightgray 35%);
        }

        #thumb {
          background: lightgray;
          border: 1px outset;
        }
      `]}render(){return p`<button @click=${this.onClickButtonLeft}>
        ${Hn}
      </button>
      <div id="scroll">
        <div
          id="left"
          style="width: ${this.zoom?100*this.zoom.leftFraction:0}%"
          @click=${this.onClickAreaLeft}
        ></div>
        <div id="thumb" @pointerdown=${this.onPointerDown}></div>
        <div
          id="right"
          style="width: ${this.zoom?100*(1-this.zoom.rightFraction):0}%"
          @click=${this.onClickAreaRight}
        ></div>
      </div>
      <button @click=${this.onClickButtonRight}>${jn}</button>`}firstUpdated(e){super.firstUpdated(e),this.dragController=new V(new Cr(this,this.scrollBox),0)}onClickButtonLeft(){this.moveZoom(-1/20)}onClickButtonRight(){this.moveZoom(1/20)}onClickAreaLeft(){this.moveZoom(-.6)}onClickAreaRight(){this.moveZoom(.6)}moveZoom(e){let t=this.zoom.withMovedCenter(e/this.zoom.level);this.zoom=t,this.dispatchEvent(new it(t))}onPointerDown(e){this.dragController?.startDragging(e)}};Er([h({attribute:!1}),Ko("design:type",typeof(Go=typeof C<"u"&&C)=="function"?Go:Object)],is.prototype,"zoom",void 0);Er([R("#scroll"),Ko("design:type",typeof(Zo=typeof HTMLElement<"u"&&HTMLElement)=="function"?Zo:Object)],is.prototype,"scrollBox",void 0);is=Er([D("rr-scrollbar")],is);var Cr=class{constructor(e,t){this.scrollbar=e,this.box=t,this.startZoom=K}startDrag(){this.startZoom=this.scrollbar.zoom}drag(e,t){let i=e/this.box.offsetWidth;this.moveZoom(i)}finishDrag(){}cancelDrag(){this.moveZoom(0)}onClick(){}moveZoom(e){let t=this.startZoom.withMovedCenter(e);this.scrollbar.zoom=t,this.scrollbar.dispatchEvent(new it(this.scrollbar.zoom))}};var Ar=function(r,e,t,i){var s=arguments.length,n=s<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,t):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,e,t,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(e,t,n):o(e,t))||n);return s>3&&n&&Object.defineProperty(e,t,n),n},Xo=function(r,e){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,e)},Qo,ss=class extends x{constructor(){super(...arguments),this.zoom=K}static get styles(){return[te,S`
        :host {
          display: flex;
          flex-direction: row;
        }

        #zoomInput {
          width: 6ex;
        }
      `]}render(){return p`<button @click=${this.onClickMinus}>${Zn}</button>
      <input
        id="zoomInput"
        type="text"
        .value=${Pr(this.zoom.level)}
        @focus=${this.onZoomFocus}
        @blur=${this.onZoomBlur}
        @change=${this.onZoomChange}
      />
      <button @click=${this.onClickPlus}>${Gn}</button>`}onZoomFocus(e){let t=e.target;t.value=Yo(this.zoom.level)}onZoomBlur(e){let t=e.target;t.value=Pr(this.zoom.level)}onZoomChange(e){let t=e.target,i=t.value;i.endsWith("x")&&(i=i.substring(0,i.length-1));let s=Number(i);isNaN(s)?t.value=Pr(this.zoom.level):this.setZoom(s)}onClickMinus(){this.setZoom(this.zoom.level/Math.sqrt(2))}onClickPlus(){this.setZoom(this.zoom.level*Math.sqrt(2))}setZoom(e){Math.abs(e-Math.round(e))<.01&&(e=Math.round(e));let t=this.zoom;this.highlight?.point!==void 0?t=t.withLevelInContext(e,this.highlight.point):t=t.withLevel(e),this.zoom=t,this.dispatchEvent(new it(t))}};Ar([h({attribute:!1}),Xo("design:type",typeof(Qo=typeof C<"u"&&C)=="function"?Qo:Object)],ss.prototype,"zoom",void 0);Ar([h({attribute:!1}),Xo("design:type",Object)],ss.prototype,"highlight",void 0);ss=Ar([D("rr-zoombar")],ss);function Pr(r){return Yo(r)+"x"}function Yo(r){return String(Math.round(r*100)/100)}var J=function(r,e,t,i){var s=arguments.length,n=s<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,t):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,e,t,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(e,t,n):o(e,t))||n);return s>3&&n&&Object.defineProperty(e,t,n),n},re=function(r,e){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,e)},Jo,ea,ta,H=class extends x{constructor(){super(...arguments),this.centerFrequency=0,this.frequencyScale=1,this.minDecibels=-100,this.maxDecibels=-30,this.fftSize=2048,this.zoom=K,this.highlightDraggablePoint=!1,this.highlightDraggableLeft=!1,this.highlightDraggableRight=!1,this.waterfallDraggable=!1}static get styles(){return[S`
        :host {
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          background: black;
          position: relative;

          --top-caption-margin: 16px;
          --left-caption-margin: 24px;
        }

        #view {
          display: flex;
          flex-direction: column;
          flex: 1;
          position: relative;
        }

        #controls {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
        }

        #controls rr-decibel-range {
          flex: 1;
          max-width: 100%;
        }

        #zoomControls {
          display: flex;
          flex-direction: row;
          flex: 10;
        }

        #zoomControls rr-scrollbar {
          min-width: 300px;
        }

        @media (max-width: 415px) {
          #zoomControls rr-scrollbar {
            min-width: 260px;
          }
        }

        .box {
          position: relative;
          width: 100%;
          height: 0;
        }

        .box > * {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          right: 0;
        }

        #scopeBox {
          flex: 1;
          max-height: 150px;
        }

        #waterfallBox {
          flex: 2;
        }

        #waterfallBox > * {
          margin-left: var(--left-caption-margin);
        }

        #highlight {
          position: absolute;
          left: var(--left-caption-margin);
          top: var(--top-caption-margin);
          right: 0;
          bottom: 0;
        }
      `]}render(){return p`<div id="view">
        <div id="scopeBox" class="box">
          <rr-scope
            id="scope"
            .minDecibels=${this.minDecibels}
            .maxDecibels=${this.maxDecibels}
            .centerFrequency=${this.centerFrequency}
            .bandwidth=${this.bandwidth}
            .frequencyScale=${this.frequencyScale}
            .fftSize=${this.fftSize}
            .zoom=${this.zoom}
          ></rr-scope>
        </div>
        <div id="waterfallBox" class="box">
          <rr-waterfall
            id="waterfall"
            .minDecibels=${this.minDecibels}
            .maxDecibels=${this.maxDecibels}
            .bandwidth=${this.bandwidth}
            .fftSize=${this.fftSize}
            .zoom=${this.zoom}
            .draggable=${this.waterfallDraggable}
          ></rr-waterfall>
        </div>
        <rr-highlight
          id="highlight"
          .selection=${this.highlight}
          .draggableLeft=${this.highlightDraggableLeft}
          .draggableRight=${this.highlightDraggableRight}
          .draggablePoint=${this.highlightDraggablePoint}
          .fftSize=${this.fftSize}
          .zoom=${this.zoom}
        ></rr-highlight>
      </div>
      <div id="controls">
        <rr-decibel-range
          .minDecibels=${this.minDecibels}
          .maxDecibels=${this.maxDecibels}
          @spectrum-decibel-range-changed=${this.onDecibelRangeChanged}
        ></rr-decibel-range>
        <div id="zoomControls">
          <rr-zoombar
            .zoom=${this.zoom}
            .highlight=${this.highlight}
            @spectrum-zoom=${this.onZoom}
          ></rr-zoombar>
          <rr-scrollbar
            .zoom=${this.zoom}
            @spectrum-zoom=${this.onZoom}
          ></rr-scrollbar>
        </div>
      </div>`}addFloatSpectrum(e,t){this.fftSize!=t.length&&(this.fftSize=t.length),this.scope?.addFloatSpectrum(t),this.waterfall?.addFloatSpectrum(e,t)}onZoom(e){this.zoom=e.detail}onDecibelRangeChanged(e){e.detail.min!==void 0&&(this.minDecibels=e.detail.min),e.detail.max!==void 0&&(this.maxDecibels=e.detail.max)}};J([h({type:Number,reflect:!0}),re("design:type",Number)],H.prototype,"bandwidth",void 0);J([h({type:Number,reflect:!0,attribute:"center-frequency"}),re("design:type",Number)],H.prototype,"centerFrequency",void 0);J([h({type:Number,reflect:!0,attribute:"frequency-scale"}),re("design:type",Number)],H.prototype,"frequencyScale",void 0);J([h({type:Number,reflect:!0,attribute:"min-decibels"}),re("design:type",Number)],H.prototype,"minDecibels",void 0);J([h({type:Number,reflect:!0,attribute:"max-decibels"}),re("design:type",Number)],H.prototype,"maxDecibels",void 0);J([h({type:Number,reflect:!0}),re("design:type",Number)],H.prototype,"fftSize",void 0);J([h({attribute:!1}),re("design:type",typeof(Jo=typeof C<"u"&&C)=="function"?Jo:Object)],H.prototype,"zoom",void 0);J([h({attribute:!1}),re("design:type",Object)],H.prototype,"highlight",void 0);J([h({attribute:!1}),re("design:type",Boolean)],H.prototype,"highlightDraggablePoint",void 0);J([h({attribute:!1}),re("design:type",Boolean)],H.prototype,"highlightDraggableLeft",void 0);J([h({attribute:!1}),re("design:type",Boolean)],H.prototype,"highlightDraggableRight",void 0);J([h({attribute:!1}),re("design:type",Boolean)],H.prototype,"waterfallDraggable",void 0);J([R("#scope"),re("design:type",typeof(ea=typeof oe<"u"&&oe)=="function"?ea:Object)],H.prototype,"scope",void 0);J([R("#waterfall"),re("design:type",typeof(ta=typeof ae<"u"&&ae)=="function"?ta:Object)],H.prototype,"waterfall",void 0);H=J([D("rr-spectrum")],H);var y=function(r,e,t,i){var s=arguments.length,n=s<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,t):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,e,t,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(e,t,n):o(e,t))||n);return s>3&&n&&Object.defineProperty(e,t,n),n},v=function(r,e){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,e)},ia,sa,ra,na,w=class extends x{static get styles(){return[te,S`
        :host {
          height: 100%;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          touch-action: none;
        }

        #spectrum {
          width: 100%;
          height: 0;
          flex: 1;
          margin: 0;
        }
      `]}render(){return p`<rr-spectrum
        id="spectrum"
        .minDecibels=${this.minDecibels}
        .maxDecibels=${this.maxDecibels}
        .centerFrequency=${this.frequency.center}
        .bandwidth=${this.bandwidth}
        .frequencyScale=${this.scale}
        .highlight=${{point:this.frequency.offset/this.bandwidth+.5,band:{left:(this.frequency.offset-this.frequency.leftBand)/this.bandwidth+.5,right:(this.frequency.offset+this.frequency.rightBand)/this.bandwidth+.5}}}
        .highlightDraggablePoint=${!0}
        .highlightDraggableLeft=${this.mode.scheme!="WBFM"&&this.mode.scheme!="USB"}
        .highlightDraggableRight=${this.mode.scheme!="WBFM"&&this.mode.scheme!="LSB"}
        .waterfallDraggable=${!0}
        @spectrum-tap=${this.onSpectrumTap}
        @spectrum-drag=${this.onSpectrumDrag}
        @spectrum-highlight-changed=${this.onSpectrumHighlightChanged}
        @spectrum-decibel-range-changed=${this.onDecibelRangeChanged}
      ></rr-spectrum>

      <rr-main-controls
        .position=${this.windowState.controls.position}
        .playing=${this.playing}
        .needsReload=${this.needsReload||this.errorState}
        .centerFrequency=${this.frequency.center}
        .tunedFrequency=${this.frequency.center+this.frequency.offset}
        .tuningStep=${this.tuningStep}
        .scale=${this.scale}
        .availableModes=${at()}
        .scheme=${this.mode.scheme}
        .bandwidth=${T(this.mode).getBandwidth()}
        .stereo=${T(this.mode).getStereo()}
        .squelch=${T(this.mode).getSquelch()}
        .stereoStatus=${this.stereoStatus}
        .gain=${this.gain}
        .gainDisabled=${this.gainDisabled}
        .maxFrequency=${this.maxFrequency}
        .deviceLabel=${this.deviceLabel()}
        .dspActive=${this.dspActive}
        .gpsLabel=${this.gpsLabel()}
        .gpsState=${this.gpsDot()}
        @rr-start=${this.onStart}
        @rr-stop=${this.onStop}
        @rr-presets=${this.onPresets}
        @rr-settings=${this.onSettings}
        @rr-scale-changed=${this.onScaleChange}
        @rr-center-frequency-changed=${this.onCenterFrequencyChange}
        @rr-tuned-frequency-changed=${this.onTunedFrequencyChange}
        @rr-tuning-step-changed=${this.onTuningStepChange}
        @rr-scheme-changed=${this.onSchemeChange}
        @rr-bandwidth-changed=${this.onBandwidthChange}
        @rr-stereo-changed=${this.onStereoChange}
        @rr-squelch-changed=${this.onSquelchChange}
        @rr-gain-changed=${this.onGainChange}
        @rr-window-moved=${this.onWindowMoved}
      ></rr-main-controls>

      <rr-settings
        .closed=${!this.windowState.settings.open}
        .position=${this.windowState.settings.position}
        .playing=${this.playing}
        .sampleRate=${this.sampleRate}
        .ppm=${this.ppm}
        .fftSize=${this.fftSize}
        .fmDeemph=${this.fmDeemph}
        .biasTee=${this.biasTee}
        .lowFrequencyMethod=${this.lowFrequencyMethod}
        .performanceTradeoff=${this.performanceTradeoff}
        .sdrKind=${this.sdrKind}
        .connectedSdr=${this.connectedSdr}
        .hackrfAmp=${this.hackrfAmp}
        .dspActive=${this.dspActive}
        .dspSimd=${this.dspSimd}
        .wasmDsp=${this.wasmDsp}
        .gpsSource=${this.gpsSource}
        .gpsStatus=${this.gpsStatus}
        .compassStatus=${this.compassStatus}
        @rr-compass-toggle=${this.onCompassToggle}
        .canInstall=${this.canInstall}
        @rr-sdr-kind-changed=${this.onSdrKindChange}
        @rr-choose-device=${this.onChooseDevice}
        @rr-hackrf-amp-changed=${this.onHackrfAmpChange}
        @rr-wasm-dsp-changed=${this.onWasmDspChange}
        @rr-gps-source-changed=${this.onGpsSourceChange}
        @rr-gps-connect=${this.onGpsConnect}
        @rr-install-app=${this.onInstallApp}
        @rr-sample-rate-changed=${this.onSampleRateChange}
        @rr-ppm-changed=${this.onPpmChange}
        @rr-fft-size-changed=${this.onFftSizeChange}
        @rr-fm-deemph-changed=${this.onFmDeemphChange}
        @rr-bias-tee-changed=${this.onBiasTeeChange}
        @rr-low-frequency-method-changed=${this.onLowFrequencyMethodChange}
        @rr-performance-tradeoff-changed=${this.onPerformanceTradeoffChange}
        @rr-window-moved=${this.onWindowMoved}
        @rr-window-closed=${this.onWindowClosed}
      ></rr-settings>

      <rr-presets
        .closed=${!this.windowState.presets.open}
        .size=${this.windowState.presets.size}
        .position=${this.windowState.presets.position}
        .tunedFrequency=${this.frequency.center+this.frequency.offset}
        .tuningStep=${this.tuningStep}
        .scale=${this.scale}
        .availableModes=${at()}
        .scheme=${this.mode.scheme}
        .bandwidth=${T(this.mode).getBandwidth()}
        .stereo=${T(this.mode).getStereo()}
        .squelch=${T(this.mode).getSquelch()}
        .gain=${this.gain}
        .presets=${this.presets}
        .sortColumn=${this.presetSortColumn}
        @rr-preset-selected=${this.onPresetSelected}
        @rr-presets-changed=${this.onPresetsChanged}
        @rr-presets-sorted=${this.onPresetsSorted}
        @rr-window-moved=${this.onWindowMoved}
        @rr-window-resized=${this.onWindowResized}
        @rr-window-closed=${this.onWindowClosed}
      ></rr-presets>`}constructor(){super(),this.onGpsChange=()=>{this.gpsStatus={...fe.status}},this.onCompassChange=()=>{this.compassStatus={...me.status}},this.onInstallChange=()=>{this.canInstall=ns()},this.availableModes=new Map(at().map(e=>[e,ai(e)])),this.sampleRate=1024e3,this.ppm=0,this.fftSize=2048,this.biasTee=!1,this.bandwidth=this.sampleRate,this.stereoStatus=!1,this.minDecibels=-90,this.maxDecibels=-20,this.playing=!1,this.errorState=!1,this.needsReload=!1,this.scale=1e3,this.frequency={center:885e5,offset:0,leftBand:75e3,rightBand:75e3},this.tuningStep=1e3,this.mode=this.availableModes.get("WBFM"),this.gain=null,this.gainDisabled=!1,this.lowFrequencyMethod={name:"default",channel:"Q",frequency:1e8,biasTee:!1},this.fmDeemph=50,this.performanceTradeoff="cpu",this.windowState={controls:{position:void 0},settings:{open:!1,position:void 0},presets:{open:!1,position:void 0,size:void 0}},this.sdrKind="auto",this.hackrfAmp=!1,this.maxFrequency=18e8,this.wasmDsp=!0,this.dspActive=Ds().active,this.dspSimd=Ds().simd,this.gpsSource=fe.savedSource(),this.gpsStatus=fe.status,this.compassStatus=me.status,this.canInstall=ns(),this.presetSortColumn="frequency",this.presets=[],this.configProvider=kn(),this.spectrumPool=new B(2,2048),this.spectrum=new Ci,this.spectrum.size=this.fftSize,this.demodulator=new hi(this.getDemodulatorOptions()),this.sampleCounter=new Mi(20),this.sdrProvider=new Ki({kind:()=>this.configProvider.get().device,hackrfAmp:()=>this.configProvider.get().hackrfAmp,onConnect:e=>this.onSdrConnected(e)}),this.radio=new Ti(new Li(this.sdrProvider),qi.of(this.spectrum,this.demodulator,this.sampleCounter)),this.demodulator.setVolume(1),this.demodulator.setMode(this.mode),this.demodulator.addEventListener("stereo-status",e=>this.onStereoStatusEvent(e)),this.radio.addEventListener("radio",e=>this.onRadioEvent(e)),this.sampleCounter.addEventListener("sample-click",e=>this.onSampleClickEvent(e))}getDemodulatorOptions(){let e=this.configProvider.get(),t=e.fmDeemph,i=e.performanceTradeoff,s=i==="latency",n=i==="quality";return{modeOptions:{AM:{downsamplerTaps:n?75:void 0,rfTaps:s?257:n?75:void 0,useFftFilter:s},CW:{downsamplerTaps:n?75:void 0,audioTaps:s?513:n?95:void 0,useFftFilter:s},NBFM:{downsamplerTaps:n?75:void 0,rfTaps:s?257:n?41:void 0,useFftFilter:s},USB:{downsamplerTaps:n?75:void 0,rfTaps:s?257:n?41:void 0,useFftFilter:s},LSB:{downsamplerTaps:n?75:void 0,rfTaps:s?257:n?75:void 0,useFftFilter:s},WBFM:{deemphasizerTc:t,downsamplerTaps:n?75:void 0,rfTaps:s||n?75:void 0,useFftFilter:s}}}}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>this.onScreenResize()),this.resizeObserver.observe(document.body),fe.addEventListener("change",this.onGpsChange),me.addEventListener("change",this.onCompassChange),fr()&&me.wasEnabled()&&!me.needsPermissionTap()&&me.start(),an(this.onInstallChange),fe.hasSavedChoice()&&fe.resume()}disconnectedCallback(){super.disconnectedCallback(),this.resizeObserver?.disconnect(),fe.removeEventListener("change",this.onGpsChange),me.removeEventListener("change",this.onCompassChange)}deviceLabel(){if(!this.connectedSdr)return this.sdrKind==="hackrf"?"HackRF \xB7 press \u25B6":this.sdrKind==="rtlsdr"?"RTL-SDR \xB7 press \u25B6":"SDR \xB7 press \u25B6";let e=this.radio.getSampleRate();return`${this.connectedSdr.name} \xB7 ${(e/1e6).toLocaleString(void 0,{maximumFractionDigits:3})} Msps`}gpsLabel(){let e=this.gpsStatus;if(e.state==="off")return"GPS off";if(e.fix){let t=e.fix.accuracyM!==void 0?` \xB1${e.fix.accuracyM.toFixed(0)} m`:"",i=this.compassStatus,s=i.state==="on"&&i.heading!==void 0?` \xB7 ${Yi(i.heading)}`:"";return`${e.fix.lat.toFixed(4)}, ${e.fix.lon.toFixed(4)}${t}${s}`}return e.state==="error"?"GPS error":e.source==="gmouse"?"G-MOUSE searching\u2026":"GPS searching\u2026"}gpsDot(){let e=this.gpsStatus.state;return e==="fix"?"ok":e==="error"?"err":e==="off"?"":"warn"}onSdrConnected(e){this.openSdr=e,this.connectedSdr={kind:e.kind,name:e.name,detail:e.detail},this.maxFrequency=e.maxFrequency}onSdrKindChange(e){let t=e.target;this.sdrKind=t.sdrKind,this.connectedSdr=void 0,this.sdrProvider.forgetDevice(),this.maxFrequency=this.sdrKind==="hackrf"?6e9:18e8,this.configProvider.update(i=>i.device=t.sdrKind)}onChooseDevice(){this.sdrProvider.forgetDevice(),this.connectedSdr=void 0}onHackrfAmpChange(e){let t=e.target;this.hackrfAmp=t.hackrfAmp,this.configProvider.update(s=>s.hackrfAmp=t.hackrfAmp);let i=this.openSdr?.device;this.radio.isPlaying()&&i instanceof mt&&i.setAmpEnabled(t.hackrfAmp)}onWasmDspChange(e){let t=e.target;this.wasmDsp=t.wasmDsp,this.configProvider.update(i=>i.wasmDsp=t.wasmDsp),this.needsReload=!0}onGpsSourceChange(e){let t=e.target;this.gpsSource=t.gpsSource,t.gpsSource!=="gmouse"?fe.start(t.gpsSource):fe.stop()}onCompassToggle(){let e=me.status.state;e==="on"||e==="starting"?me.stop():me.start()}onGpsConnect(){fe.start(this.gpsSource,{pickPort:!0})}onInstallApp(){ln()}firstUpdated(e){super.firstUpdated(e),this.applyConfig()}applyConfig(){let e=this.configProvider.get();for(let t of this.availableModes.keys()){let i={...this.availableModes.get(t),...e.modes[t]};this.availableModes.set(t,i),t==e.mode&&this.setMode(i)}this.setLowFrequencyMethod(e.lowFrequencyMethod),this.setCenterFrequency(e.centerFrequency),this.setTunedFrequency(e.tunedFrequency),this.tuningStep=e.tuningStep,this.scale=e.frequencyScale,this.setGain(e.gain),this.setSampleRate(e.sampleRate),this.setPpm(e.ppm),this.setFftSize(e.fftSize),this.enableBiasTee(e.biasTee),this.sdrKind=e.device,this.hackrfAmp=e.hackrfAmp,this.wasmDsp=e.wasmDsp,this.maxFrequency=e.device==="hackrf"?6e9:18e8,this.fmDeemph=e.fmDeemph,this.performanceTradeoff=e.performanceTradeoff,this.minDecibels=e.minDecibels,this.maxDecibels=e.maxDecibels,this.presetSortColumn=e.presets.sortColumn,this.presets=e.presets.list,this.windowState=e.windows}isFrequencyValid(e){let t=e.offset-e.leftBand,i=e.offset+e.rightBand;return-this.bandwidth/2<=t&&i<=this.bandwidth/2}onSampleClickEvent(e){let t=this.spectrumPool.get(this.spectrum.size);this.spectrum.getSpectrum(t),this.spectrumView.addFloatSpectrum(this.spectrum.frequency(),t)}onStart(e){this.bandwidth=this.radio.getSampleRate(),this.radio.start(),e.preventDefault()}onStop(e){this.radio.stop(),e.preventDefault()}onScreenResize(){this.requestUpdate()}onPresets(){this.changeWindowState(e=>e.presets.open=!0)}onSettings(){this.changeWindowState(e=>e.settings.open=!0)}changeWindowState(e){let t={...this.windowState};e(t),this.windowState=t,this.configProvider.update(i=>i.windows=this.windowState)}getWindowName(e){return e===this.mainControlsWindow?"controls":e===this.settingsWindow?"settings":e===this.presetsWindow?"presets":void 0}onWindowClosed(e){let t=this.getWindowName(e.target);if(t===void 0)return;let s=e.target?.closed;s!==void 0&&this.changeWindowState(n=>n[t].open=!s)}onWindowMoved(e){let t=this.getWindowName(e.target);if(t===void 0)return;let s=e.target?.position;s&&this.changeWindowState(n=>n[t].position=s)}onWindowResized(e){let t=this.getWindowName(e.target);if(t===void 0)return;let s=e.target?.size;s&&this.changeWindowState(n=>n[t].size=s)}onScaleChange(e){let i=e.target.scale;this.scale=i}onCenterFrequencyChange(e){let i=e.target.centerFrequency;this.setCenterFrequency(i)}setCenterFrequency(e){let t={...this.frequency,center:e,offset:this.frequency.center+this.frequency.offset-e};this.isFrequencyValid(t)||(t={...t,offset:0}),this.setFrequency(t)}onTunedFrequencyChange(e){let i=e.target.tunedFrequency;this.setTunedFrequency(i)}onTuningStepChange(e){let i=e.target.tuningStep;this.tuningStep=i,this.configProvider.update(s=>s.tuningStep=i)}setTunedFrequency(e){let t={...this.frequency,offset:e-this.frequency.center};this.isFrequencyValid(t)||(t={...t,center:t.center+t.offset,offset:0}),this.setFrequency(t)}setFrequency(e,t){if(e.center!=this.frequency.center||t){let i=e.center<288e5&&this.lowFrequencyMethod.name=="upconverter",s=i?this.lowFrequencyMethod.frequency:0;e.offset!=this.frequency.offset&&this.demodulator.expectFrequencyAndSetOffset(e.center+s,e.offset),this.radio.setFrequency(e.center+s),this.radio.enableBiasTee(this.biasTee||i&&this.lowFrequencyMethod.biasTee)}else e.offset!=this.frequency.offset&&this.demodulator.setFrequencyOffset(e.offset);this.frequency=e,this.configProvider.update(i=>{i.centerFrequency=e.center,i.tunedFrequency=e.center+e.offset})}onSchemeChange(e){let i=e.target.scheme,s=this.availableModes.get(i);s!==void 0&&this.setMode(s)}onBandwidthChange(e){let i=e.target.bandwidth;this.setMode(T(this.mode).setBandwidth(i).mode)}onStereoChange(e){let i=e.target.stereo;this.setMode(T(this.mode).setStereo(i).mode)}onSquelchChange(e){let i=e.target.squelch;this.setMode(T(this.mode).setSquelch(i).mode)}setMode(e){this.demodulator.setMode(e),this.mode=e,this.availableModes.set(e.scheme,e),this.updateFrequencyBands(),this.configProvider.update(t=>{t.mode=e.scheme,t.modes[e.scheme]=e})}updateFrequencyBands(){let e=T(this.mode).getBandwidth(),t={...this.frequency};this.mode.scheme=="USB"?(t.leftBand=0,t.rightBand=e):this.mode.scheme=="LSB"?(t.leftBand=e,t.rightBand=0):t.leftBand=t.rightBand=e/2,this.isFrequencyValid(t)||(t={...t,center:t.center+t.offset,offset:0}),this.setFrequency(t)}onGainChange(e){let t=e.target;this.setGain(t.gain)}setGain(e){this.radio.setGain(e),this.gain=e,this.configProvider.update(t=>t.gain=e)}onSampleRateChange(e){let t=e.target;this.setSampleRate(t.sampleRate)}setSampleRate(e){this.sampleRate=e,this.radio.setSampleRate(e),this.configProvider.update(t=>t.sampleRate=e),!this.radio.isPlaying()&&(this.bandwidth=e,this.setTunedFrequency(this.frequency.center+this.frequency.offset))}onPpmChange(e){let t=e.target;this.setPpm(t.ppm)}setPpm(e){this.radio.setFrequencyCorrection(this.ppm),this.ppm=e,this.configProvider.update(t=>t.ppm=e)}onFftSizeChange(e){let t=e.target;this.setFftSize(t.fftSize)}setFftSize(e){this.fftSize=e,this.spectrum.size=e,this.configProvider.update(t=>t.fftSize=e)}onFmDeemphChange(e){let t=e.target;this.configProvider.update(i=>i.fmDeemph=t.fmDeemph),this.needsReload=!0}onPerformanceTradeoffChange(e){let t=e.target;this.configProvider.update(i=>i.performanceTradeoff=t.performanceTradeoff),this.needsReload=!0}onBiasTeeChange(e){let t=e.target;this.enableBiasTee(t.biasTee)}enableBiasTee(e){this.radio.enableBiasTee(e),this.biasTee=e,this.configProvider.update(t=>t.biasTee=e)}onLowFrequencyMethodChange(e){let t=e.target;this.setLowFrequencyMethod(t.lowFrequencyMethod)}setLowFrequencyMethod(e){let t=e.name!="directSampling"?j.Off:e.channel=="Q"?j.Q:j.I;this.radio.setDirectSamplingMethod(t),this.lowFrequencyMethod={...e},this.setFrequency({...this.frequency},!0),this.configProvider.update(i=>i.lowFrequencyMethod=e)}onPresetSelected(e){let t=e.target,i=t.selectedIndex;if(i===void 0)return;let s=t.presets[i];this.setTunedFrequency(s.tunedFrequency),this.scale=s.scale,this.tuningStep=s.tuningStep,this.setMode(T(s.scheme).setBandwidth(s.bandwidth).setStereo(s.stereo).setSquelch(s.squelch).mode),this.setGain(s.gain)}onPresetsChanged(e){let i=[...e.target.presets];this.presets=i,this.configProvider.update(s=>s.presets.list=i)}onPresetsSorted(e){let i=e.target.sortColumn;this.presetSortColumn=i,this.configProvider.update(s=>s.presets.sortColumn=i)}onSpectrumTap(e){this.setTunedFrequencyFraction(e.detail.fraction)}onSpectrumDrag(e){e.detail.operation=="start"?(this.centerFrequencyScroller?.cancel(),this.centerFrequencyScroller=new qr(this.bandwidth,this.scale,this.frequency,t=>this.setFrequency(t))):e.detail.operation=="cancel"?(this.centerFrequencyScroller?.cancel(),this.centerFrequencyScroller=void 0):e.detail.operation=="finish"?(this.centerFrequencyScroller?.finish(),this.centerFrequencyScroller=void 0):this.centerFrequencyScroller?.drag(e)}onDecibelRangeChanged(e){let{min:t,max:i}=e.detail;t!==void 0&&(this.minDecibels=t,this.configProvider.update(s=>s.minDecibels=t)),i!==void 0&&(this.maxDecibels=i,this.configProvider.update(s=>s.maxDecibels=i))}onSpectrumHighlightChanged(e){e.detail.fraction!==void 0?this.setTunedFrequencyFraction(e.detail.fraction):e.detail.startFraction!==void 0?this.setSidebandFraction("left",e.detail.startFraction):e.detail.endFraction!==void 0&&this.setSidebandFraction("right",e.detail.endFraction)}setTunedFrequencyFraction(e){let t=this.frequency.center-this.bandwidth/2+this.frequency.leftBand,i=this.frequency.center+this.bandwidth/2-this.frequency.rightBand,s=Math.max(t,Math.min(this.frequency.center+this.bandwidth*(e-.5),i));s=this.tuningStep*Math.round(s/this.tuningStep),s<t&&(s+=this.tuningStep),s>i&&(s-=this.tuningStep),this.setTunedFrequency(s)}setSidebandFraction(e,t){let i=Math.floor(this.frequency.offset+this.bandwidth/2),s=Math.floor(this.bandwidth/2-this.frequency.offset),n=Math.floor(Math.abs(this.frequency.offset-this.bandwidth*(t-.5))),o=T(this.mode);switch(this.mode.scheme){case"WBFM":return;case"NBFM":case"AM":case"CW":o.setBandwidth(Math.min(n,i,s)*2);break;case"LSB":if(e=="right")return;o.setBandwidth(Math.min(n,i));break;case"USB":if(e=="left")return;o.setBandwidth(Math.min(n,s));break}this.setMode(o.mode)}onStereoStatusEvent(e){this.stereoStatus=e.detail}onRadioEvent(e){switch(e.detail.type){case"started":{this.playing=!0;let i=this.radio.getSampleRate();i!==this.bandwidth&&(this.bandwidth=i,this.sampleRate=i,this.configProvider.update(s=>s.sampleRate=i),this.setTunedFrequency(this.frequency.center+this.frequency.offset));break}case"stopped":this.playing=!1;break;case"directSampling":this.gainDisabled=e.detail.active;break;case"error":let t=e.detail.exception;if(t.type===_.NoDeviceSelected&&t.cause.name==="NotFoundError")return;t.type==_.NoUsbSupport?alert("This browser does not support the HTML5 USB API. Please try Chrome, Edge, or Opera on a computer or Android."):this.errorState||(this.errorState=!0,t.cause?alert(`${t.message}

Caused by: ${t.cause}`):alert(t.message));break;default:}}};y([b(),v("design:type",Number)],w.prototype,"sampleRate",void 0);y([b(),v("design:type",Number)],w.prototype,"ppm",void 0);y([b(),v("design:type",Number)],w.prototype,"fftSize",void 0);y([b(),v("design:type",Boolean)],w.prototype,"biasTee",void 0);y([b(),v("design:type",Number)],w.prototype,"bandwidth",void 0);y([b(),v("design:type",Boolean)],w.prototype,"stereoStatus",void 0);y([b(),v("design:type",Number)],w.prototype,"minDecibels",void 0);y([b(),v("design:type",Number)],w.prototype,"maxDecibels",void 0);y([b(),v("design:type",Boolean)],w.prototype,"playing",void 0);y([b(),v("design:type",Boolean)],w.prototype,"errorState",void 0);y([b(),v("design:type",Boolean)],w.prototype,"needsReload",void 0);y([b(),v("design:type",Number)],w.prototype,"scale",void 0);y([b(),v("design:type",Object)],w.prototype,"frequency",void 0);y([b(),v("design:type",Number)],w.prototype,"tuningStep",void 0);y([b(),v("design:type",Object)],w.prototype,"mode",void 0);y([b(),v("design:type",Object)],w.prototype,"gain",void 0);y([b(),v("design:type",Boolean)],w.prototype,"gainDisabled",void 0);y([b(),v("design:type",Object)],w.prototype,"lowFrequencyMethod",void 0);y([b(),v("design:type",Number)],w.prototype,"fmDeemph",void 0);y([b(),v("design:type",Object)],w.prototype,"performanceTradeoff",void 0);y([b(),v("design:type",Object)],w.prototype,"windowState",void 0);y([b(),v("design:type",Object)],w.prototype,"sdrKind",void 0);y([b(),v("design:type",Object)],w.prototype,"connectedSdr",void 0);y([b(),v("design:type",Boolean)],w.prototype,"hackrfAmp",void 0);y([b(),v("design:type",Number)],w.prototype,"maxFrequency",void 0);y([b(),v("design:type",Boolean)],w.prototype,"wasmDsp",void 0);y([b(),v("design:type",Boolean)],w.prototype,"dspActive",void 0);y([b(),v("design:type",Boolean)],w.prototype,"dspSimd",void 0);y([b(),v("design:type",Object)],w.prototype,"gpsSource",void 0);y([b(),v("design:type",Object)],w.prototype,"gpsStatus",void 0);y([b(),v("design:type",Object)],w.prototype,"compassStatus",void 0);y([b(),v("design:type",Boolean)],w.prototype,"canInstall",void 0);y([b(),v("design:type",String)],w.prototype,"presetSortColumn",void 0);y([b(),v("design:type",Array)],w.prototype,"presets",void 0);y([R("#spectrum"),v("design:type",typeof(ia=typeof H<"u"&&H)=="function"?ia:Object)],w.prototype,"spectrumView",void 0);y([R("rr-main-controls"),v("design:type",typeof(sa=typeof M<"u"&&M)=="function"?sa:Object)],w.prototype,"mainControlsWindow",void 0);y([R("rr-settings"),v("design:type",typeof(ra=typeof A<"u"&&A)=="function"?ra:Object)],w.prototype,"settingsWindow",void 0);y([R("rr-presets"),v("design:type",typeof(na=typeof E<"u"&&E)=="function"?na:Object)],w.prototype,"presetsWindow",void 0);w=y([D("radioreceiver-main"),v("design:paramtypes",[])],w);var qr=class{constructor(e,t,i,s){this.bandwidth=e,this.scale=t,this.setFrequency=s,this.original={...i}}drag(e){let i=-e.detail.fraction*this.bandwidth,s=this.original.center+i;s=this.scale*Math.round(s/this.scale);let n={...this.original,center:s,offset:this.original.center+this.original.offset-s};n.offset-n.leftBand<=-this.bandwidth/2&&(n.offset=n.leftBand-this.bandwidth/2),this.bandwidth/2<=n.offset+n.rightBand&&(n.offset=this.bandwidth/2-n.rightBand),this.scheduleFrequencyChange(n)}cancel(){this.newFreq=this.original,this.changeFrequency()}finish(){this.changeFrequency()}scheduleFrequencyChange(e){this.newFreq=e,this.timeout==null&&(this.timeout=window.setTimeout(()=>this.changeFrequency(),50))}changeFrequency(){this.newFreq!==void 0&&(this.setFrequency(this.newFreq),this.newFreq=void 0,clearTimeout(this.timeout),this.timeout=void 0)}};no();function pl(){try{return JSON.parse(localStorage.getItem("config")||"{}")?.v1?.wasmDsp!==!1}catch{return!0}}function oa(r){(pl()?Mn(new URL("webrx_dsp.wasm",location.href)):Promise.resolve(!1)).finally(()=>{document.readyState==="loading"?document.addEventListener("DOMContentLoaded",r,{once:!0}):r()})}function aa(){"serviceWorker"in navigator&&navigator.serviceWorker.register("offline.js").catch(r=>{console.warn("Service worker registration failed:",r)})}aa();oa(()=>{document.getElementById("boot")?.remove(),document.body.appendChild(document.createElement("radioreceiver-main"))});})();
/*! Bundled license information:

@lit/reactive-element/css-tag.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/reactive-element.js:
lit-html/lit-html.js:
lit-element/lit-element.js:
@lit/reactive-element/decorators/custom-element.js:
@lit/reactive-element/decorators/property.js:
@lit/reactive-element/decorators/state.js:
@lit/reactive-element/decorators/event-options.js:
@lit/reactive-element/decorators/base.js:
@lit/reactive-element/decorators/query.js:
@lit/reactive-element/decorators/query-all.js:
@lit/reactive-element/decorators/query-async.js:
@lit/reactive-element/decorators/query-assigned-nodes.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/is-server.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-assigned-elements.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/
