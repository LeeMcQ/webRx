"use strict";(()=>{var We=globalThis,Ve=We.ShadowRoot&&(We.ShadyCSS===void 0||We.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Li=Symbol(),Ar=new WeakMap,be=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==Li)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o,e=this.t;if(Ve&&t===void 0){let i=e!==void 0&&e.length===1;i&&(t=Ar.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&Ar.set(e,t))}return t}toString(){return this.cssText}},Fr=r=>new be(typeof r=="string"?r:r+"",void 0,Li),b=(r,...t)=>{let e=r.length===1?r[0]:t.reduce(((i,s,n)=>i+(o=>{if(o._$cssResult$===!0)return o.cssText;if(typeof o=="number")return o;throw Error("Value passed to 'css' function must be a 'css' function result: "+o+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+r[n+1]),r[0]);return new be(e,r,Li)},Ui=(r,t)=>{if(Ve)r.adoptedStyleSheets=t.map((e=>e instanceof CSSStyleSheet?e:e.styleSheet));else for(let e of t){let i=document.createElement("style"),s=We.litNonce;s!==void 0&&i.setAttribute("nonce",s),i.textContent=e.cssText,r.appendChild(i)}},Ge=Ve?r=>r:r=>r instanceof CSSStyleSheet?(t=>{let e="";for(let i of t.cssRules)e+=i.cssText;return Fr(e)})(r):r;var{is:go,defineProperty:bo,getOwnPropertyDescriptor:wo,getOwnPropertyNames:yo,getOwnPropertySymbols:vo,getPrototypeOf:xo}=Object,Ze=globalThis,Cr=Ze.trustedTypes,So=Cr?Cr.emptyScript:"",_o=Ze.reactiveElementPolyfillSupport,we=(r,t)=>r,ye={toAttribute(r,t){switch(t){case Boolean:r=r?So:null;break;case Object:case Array:r=r==null?r:JSON.stringify(r)}return r},fromAttribute(r,t){let e=r;switch(t){case Boolean:e=r!==null;break;case Number:e=r===null?null:Number(r);break;case Object:case Array:try{e=JSON.parse(r)}catch{e=null}}return e}},Ke=(r,t)=>!go(r,t),Pr={attribute:!0,type:String,converter:ye,reflect:!1,hasChanged:Ke};Symbol.metadata??=Symbol("metadata"),Ze.litPropertyMetadata??=new WeakMap;var wt=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=Pr){if(e.state&&(e.attribute=!1),this._$Ei(),this.elementProperties.set(t,e),!e.noAccessor){let i=Symbol(),s=this.getPropertyDescriptor(t,i,e);s!==void 0&&bo(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){let{get:s,set:n}=wo(this.prototype,t)??{get(){return this[e]},set(o){this[e]=o}};return{get(){return s?.call(this)},set(o){let a=s?.call(this);n.call(this,o),this.requestUpdate(t,a,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??Pr}static _$Ei(){if(this.hasOwnProperty(we("elementProperties")))return;let t=xo(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(we("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(we("properties"))){let e=this.properties,i=[...yo(e),...vo(e)];for(let s of i)this.createProperty(s,e[s])}let t=this[Symbol.metadata];if(t!==null){let e=litPropertyMetadata.get(t);if(e!==void 0)for(let[i,s]of e)this.elementProperties.set(i,s)}this._$Eh=new Map;for(let[e,i]of this.elementProperties){let s=this._$Eu(e,i);s!==void 0&&this._$Eh.set(s,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){let e=[];if(Array.isArray(t)){let i=new Set(t.flat(1/0).reverse());for(let s of i)e.unshift(Ge(s))}else t!==void 0&&e.push(Ge(t));return e}static _$Eu(t,e){let i=e.attribute;return i===!1?void 0:typeof i=="string"?i:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise((t=>this.enableUpdating=t)),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach((t=>t(this)))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){let t=new Map,e=this.constructor.elementProperties;for(let i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){let t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Ui(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach((t=>t.hostConnected?.()))}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach((t=>t.hostDisconnected?.()))}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$EC(t,e){let i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(s!==void 0&&i.reflect===!0){let n=(i.converter?.toAttribute!==void 0?i.converter:ye).toAttribute(e,i.type);this._$Em=t,n==null?this.removeAttribute(s):this.setAttribute(s,n),this._$Em=null}}_$AK(t,e){let i=this.constructor,s=i._$Eh.get(t);if(s!==void 0&&this._$Em!==s){let n=i.getPropertyOptions(s),o=typeof n.converter=="function"?{fromAttribute:n.converter}:n.converter?.fromAttribute!==void 0?n.converter:ye;this._$Em=s,this[s]=o.fromAttribute(e,n.type),this._$Em=null}}requestUpdate(t,e,i){if(t!==void 0){if(i??=this.constructor.getPropertyOptions(t),!(i.hasChanged??Ke)(this[t],e))return;this.P(t,e,i)}this.isUpdatePending===!1&&(this._$ES=this._$ET())}P(t,e,i){this._$AL.has(t)||this._$AL.set(t,e),i.reflect===!0&&this._$Em!==t&&(this._$Ej??=new Set).add(t)}async _$ET(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}let t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[s,n]of this._$Ep)this[s]=n;this._$Ep=void 0}let i=this.constructor.elementProperties;if(i.size>0)for(let[s,n]of i)n.wrapped!==!0||this._$AL.has(s)||this[s]===void 0||this.P(s,this[s],n)}let t=!1,e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach((i=>i.hostUpdate?.())),this.update(e)):this._$EU()}catch(i){throw t=!1,this._$EU(),i}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach((e=>e.hostUpdated?.())),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EU(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Ej&&=this._$Ej.forEach((e=>this._$EC(e,this[e]))),this._$EU()}updated(t){}firstUpdated(t){}};wt.elementStyles=[],wt.shadowRootOptions={mode:"open"},wt[we("elementProperties")]=new Map,wt[we("finalized")]=new Map,_o?.({ReactiveElement:wt}),(Ze.reactiveElementVersions??=[]).push("2.0.4");var Ki=globalThis,Qe=Ki.trustedTypes,Tr=Qe?Qe.createPolicy("lit-html",{createHTML:r=>r}):void 0,zr="$lit$",Ft=`lit$${Math.random().toFixed(9).slice(2)}$`,Or="?"+Ft,Ro=`<${Or}>`,Nt=document,xe=()=>Nt.createComment(""),Se=r=>r===null||typeof r!="object"&&typeof r!="function",Qi=Array.isArray,Do=r=>Qi(r)||typeof r?.[Symbol.iterator]=="function",Hi=`[ 	
\f\r]`,ve=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,kr=/-->/g,Ir=/>/g,Bt=RegExp(`>|${Hi}(?:([^\\s"'>=/]+)(${Hi}*=${Hi}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Br=/'/g,qr=/"/g,Lr=/^(?:script|style|textarea|title)$/i,Xi=r=>(t,...e)=>({_$litType$:r,strings:t,values:e}),p=Xi(1),B=Xi(2),fa=Xi(3),zt=Symbol.for("lit-noChange"),g=Symbol.for("lit-nothing"),Nr=new WeakMap,qt=Nt.createTreeWalker(Nt,129);function Ur(r,t){if(!Qi(r)||!r.hasOwnProperty("raw"))throw Error("invalid template strings array");return Tr!==void 0?Tr.createHTML(t):t}var $o=(r,t)=>{let e=r.length-1,i=[],s,n=t===2?"<svg>":t===3?"<math>":"",o=ve;for(let a=0;a<e;a++){let l=r[a],c,u,d=-1,m=0;for(;m<l.length&&(o.lastIndex=m,u=o.exec(l),u!==null);)m=o.lastIndex,o===ve?u[1]==="!--"?o=kr:u[1]!==void 0?o=Ir:u[2]!==void 0?(Lr.test(u[2])&&(s=RegExp("</"+u[2],"g")),o=Bt):u[3]!==void 0&&(o=Bt):o===Bt?u[0]===">"?(o=s??ve,d=-1):u[1]===void 0?d=-2:(d=o.lastIndex-u[2].length,c=u[1],o=u[3]===void 0?Bt:u[3]==='"'?qr:Br):o===qr||o===Br?o=Bt:o===kr||o===Ir?o=ve:(o=Bt,s=void 0);let f=o===Bt&&r[a+1].startsWith("/>")?" ":"";n+=o===ve?l+Ro:d>=0?(i.push(c),l.slice(0,d)+zr+l.slice(d)+Ft+f):l+Ft+(d===-2?a:f)}return[Ur(r,n+(r[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),i]},_e=class r{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let n=0,o=0,a=t.length-1,l=this.parts,[c,u]=$o(t,e);if(this.el=r.createElement(c,i),qt.currentNode=this.el.content,e===2||e===3){let d=this.el.content.firstChild;d.replaceWith(...d.childNodes)}for(;(s=qt.nextNode())!==null&&l.length<a;){if(s.nodeType===1){if(s.hasAttributes())for(let d of s.getAttributeNames())if(d.endsWith(zr)){let m=u[o++],f=s.getAttribute(d).split(Ft),x=/([.?@])?(.*)/.exec(m);l.push({type:1,index:n,name:x[2],strings:f,ctor:x[1]==="."?Wi:x[1]==="?"?Vi:x[1]==="@"?Gi:Qt}),s.removeAttribute(d)}else d.startsWith(Ft)&&(l.push({type:6,index:n}),s.removeAttribute(d));if(Lr.test(s.tagName)){let d=s.textContent.split(Ft),m=d.length-1;if(m>0){s.textContent=Qe?Qe.emptyScript:"";for(let f=0;f<m;f++)s.append(d[f],xe()),qt.nextNode(),l.push({type:2,index:++n});s.append(d[m],xe())}}}else if(s.nodeType===8)if(s.data===Or)l.push({type:2,index:n});else{let d=-1;for(;(d=s.data.indexOf(Ft,d+1))!==-1;)l.push({type:7,index:n}),d+=Ft.length-1}n++}}static createElement(t,e){let i=Nt.createElement("template");return i.innerHTML=t,i}};function Kt(r,t,e=r,i){if(t===zt)return t;let s=i!==void 0?e._$Co?.[i]:e._$Cl,n=Se(t)?void 0:t._$litDirective$;return s?.constructor!==n&&(s?._$AO?.(!1),n===void 0?s=void 0:(s=new n(r),s._$AT(r,e,i)),i!==void 0?(e._$Co??=[])[i]=s:e._$Cl=s),s!==void 0&&(t=Kt(r,s._$AS(r,t.values),s,i)),t}var ji=class{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){let{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??Nt).importNode(e,!0);qt.currentNode=s;let n=qt.nextNode(),o=0,a=0,l=i[0];for(;l!==void 0;){if(o===l.index){let c;l.type===2?c=new Re(n,n.nextSibling,this,t):l.type===1?c=new l.ctor(n,l.name,l.strings,this,t):l.type===6&&(c=new Zi(n,this,t)),this._$AV.push(c),l=i[++a]}o!==l?.index&&(n=qt.nextNode(),o++)}return qt.currentNode=Nt,s}p(t){let e=0;for(let i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}},Re=class r{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=g,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode,e=this._$AM;return e!==void 0&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=Kt(this,t,e),Se(t)?t===g||t==null||t===""?(this._$AH!==g&&this._$AR(),this._$AH=g):t!==this._$AH&&t!==zt&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):Do(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==g&&Se(this._$AH)?this._$AA.nextSibling.data=t:this.T(Nt.createTextNode(t)),this._$AH=t}$(t){let{values:e,_$litType$:i}=t,s=typeof i=="number"?this._$AC(t):(i.el===void 0&&(i.el=_e.createElement(Ur(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{let n=new ji(s,this),o=n.u(this.options);n.p(e),this.T(o),this._$AH=n}}_$AC(t){let e=Nr.get(t.strings);return e===void 0&&Nr.set(t.strings,e=new _e(t)),e}k(t){Qi(this._$AH)||(this._$AH=[],this._$AR());let e=this._$AH,i,s=0;for(let n of t)s===e.length?e.push(i=new r(this.O(xe()),this.O(xe()),this,this.options)):i=e[s],i._$AI(n),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t&&t!==this._$AB;){let i=t.nextSibling;t.remove(),t=i}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}},Qt=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,n){this.type=1,this._$AH=g,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=n,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=g}_$AI(t,e=this,i,s){let n=this.strings,o=!1;if(n===void 0)t=Kt(this,t,e,0),o=!Se(t)||t!==this._$AH&&t!==zt,o&&(this._$AH=t);else{let a=t,l,c;for(t=n[0],l=0;l<n.length-1;l++)c=Kt(this,a[i+l],e,l),c===zt&&(c=this._$AH[l]),o||=!Se(c)||c!==this._$AH[l],c===g?t=g:t!==g&&(t+=(c??"")+n[l+1]),this._$AH[l]=c}o&&!s&&this.j(t)}j(t){t===g?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},Wi=class extends Qt{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===g?void 0:t}},Vi=class extends Qt{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==g)}},Gi=class extends Qt{constructor(t,e,i,s,n){super(t,e,i,s,n),this.type=5}_$AI(t,e=this){if((t=Kt(this,t,e,0)??g)===zt)return;let i=this._$AH,s=t===g&&i!==g||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,n=t!==g&&(i===g||s);s&&this.element.removeEventListener(this.name,this,i),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}},Zi=class{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){Kt(this,t)}};var Mo=Ki.litHtmlPolyfillSupport;Mo?.(_e,Re),(Ki.litHtmlVersions??=[]).push("3.2.1");var Hr=(r,t,e)=>{let i=e?.renderBefore??t,s=i._$litPart$;if(s===void 0){let n=e?.renderBefore??null;i._$litPart$=s=new Re(t.insertBefore(xe(),n),n,void 0,e??{})}return s._$AI(r),s};var w=class extends wt{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){let e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Hr(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return zt}};w._$litElement$=!0,w.finalized=!0,globalThis.litElementHydrateSupport?.({LitElement:w});var Eo=globalThis.litElementPolyfillSupport;Eo?.({LitElement:w});(globalThis.litElementVersions??=[]).push("4.1.1");var y=r=>(t,e)=>{e!==void 0?e.addInitializer((()=>{customElements.define(r,t)})):customElements.define(r,t)};var Ao={attribute:!0,type:String,converter:ye,reflect:!1,hasChanged:Ke},Fo=(r=Ao,t,e)=>{let{kind:i,metadata:s}=e,n=globalThis.litPropertyMetadata.get(s);if(n===void 0&&globalThis.litPropertyMetadata.set(s,n=new Map),n.set(e.name,r),i==="accessor"){let{name:o}=e;return{set(a){let l=t.get.call(this);t.set.call(this,a),this.requestUpdate(o,l,r)},init(a){return a!==void 0&&this.P(o,void 0,r),a}}}if(i==="setter"){let{name:o}=e;return function(a){let l=this[o];t.call(this,a),this.requestUpdate(o,l,r)}}throw Error("Unsupported decorator location: "+i)};function h(r){return(t,e)=>typeof e=="object"?Fo(r,t,e):((i,s,n)=>{let o=s.hasOwnProperty(n);return s.constructor.createProperty(n,o?{...i,wrapped:!0}:i),o?Object.getOwnPropertyDescriptor(s,n):void 0})(r,t,e)}function K(r){return h({...r,state:!0,attribute:!1})}var Ot=(r,t,e)=>(e.configurable=!0,e.enumerable=!0,Reflect.decorate&&typeof t!="object"&&Object.defineProperty(r,t,e),e);function v(r,t){return(e,i,s)=>{let n=o=>o.renderRoot?.querySelector(r)??null;if(t){let{get:o,set:a}=typeof i=="object"?e:s??(()=>{let l=Symbol();return{get(){return this[l]},set(c){this[l]=c}}})();return Ot(e,i,{get(){let l=o.call(this);return l===void 0&&(l=n(this),(l!==null||this.hasUpdated)&&a.call(this,l)),l}})}return Ot(e,i,{get(){return n(this)}})}}function Lt(r,t,e){Yi.set(r,{demod:t,config:e})}function jr(){return[...Yi.keys()]}function Xe(r){let t=Wr(r);return new t.config(r).mode}function Q(r){let t=Wr(r);return new t.config(r)}var it=class{base;constructor(t){this.base=t}get mode(){return typeof this.base=="string"&&(this.base=this.create(this.base)),this.base}set mode(t){this.base=t}hasStereo(){return!1}getStereo(){return!1}setStereo(t){return this}hasBandwidth(){return!1}setBandwidth(t){return this}hasSquelch(){return!1}getSquelch(){return 0}setSquelch(t){return this}},Yi=new Map;function Wr(r){let t=typeof r=="string"?r:r.scheme,e=Yi.get(t);if(!e)throw`Scheme "${t}" was not registered.`;return e}var Ji=class{make;constructor(t,e,i){this.make=t,this.buffers=[...Array(e).keys()].map(()=>t(i||0)),this.current=0}buffers;current;get(t){let e=this.buffers[this.current];return e.length<t&&(e=this.make(t),this.buffers[this.current]=e),this.current=(this.current+1)%this.buffers.length,e.length==t?e:e.subarray(0,t)}};var F=class extends Ji{constructor(t,e){super(i=>new Float32Array(i),t,e)}},yt=class{constructor(t,e){this.pools=new F(t*2,e)}pools;get(t){return[this.pools.get(t),this.pools.get(t)]}},ts=class{buffer;constructor(t){this.buffer=t,this.readPos=0,this.writePos=0,this.filled=0}readPos;writePos;filled;get capacity(){return this.buffer.length}get available(){return this.filled}clear(){this.readPos=0,this.writePos=0,this.filled=0}fill(t,e){if(e===void 0||e>=this.buffer.length){this.buffer.fill(t),this.readPos=0,this.writePos=0,this.filled=this.buffer.length;return}let i=e,s=this.writePos;for(;i>0;){let n=Math.min(i,this.buffer.length-this.writePos);this.buffer.subarray(s,s+n).fill(t),s=(s+n)%this.buffer.length,i-=n}this.writePos=s,this.filled=Math.min(this.buffer.length,this.filled+e),this.filled==this.buffer.length&&(this.readPos=this.writePos)}store(t){let e=Math.min(t.length,this.buffer.length),{dstOffset:i}=this.doCopy(e,t,t.length-e,this.buffer,this.writePos);this.writePos=i,this.filled=Math.min(this.buffer.length,this.filled+e),this.filled==this.buffer.length&&(this.readPos=this.writePos)}moveTo(t){let e=Math.min(t.length,this.buffer.length,this.filled);if(e==0)return 0;let{srcOffset:i}=this.doCopy(e,this.buffer,this.readPos,t,0);return this.readPos=i,this.filled-=e,e}consume(t){let e=Math.min(this.filled,t);this.readPos=(this.readPos+e)%this.buffer.length,this.filled-=e}copyTo(t){let e=Math.min(t.length,this.buffer.length),i=(this.writePos+this.buffer.length-e)%this.buffer.length;this.doCopy(e,this.buffer,i,t,0)}doCopy(t,e,i,s,n){for(;t>0;){let o=Math.min(t,e.length-i,s.length-n);s.set(e.subarray(i,i+o),n),i=(i+o)%e.length,n=(n+o)%s.length,t-=o}return{srcOffset:i,dstOffset:n}}},Ut=class extends ts{constructor(t){super(new Float32Array(t))}};function q(r,t,e,i){i===void 0&&(i=1),e+=(e+1)%2;let s=t/r,n=new Float32Array(e),o=Math.floor(e/2),a=0;for(let l=0;l<e;++l){let c;l==o?c=2*Math.PI*s:(c=Math.sin(2*Math.PI*s*(l-o))/(l-o),c*=.54-.46*Math.cos(2*Math.PI*l/(e-1))),a+=c,n[l]=c}a/=i;for(let l=0;l<e;++l)n[l]/=a;return n}function Vr(r){r+=(r+1)%2;let t=Math.floor(r/2),e=new Float32Array(r);for(let i=0;i<e.length;++i)i%2==0&&(e[i]=2/(Math.PI*(t-i)));return e}function Xt(r){if(r<4&&(r=4),(r-1&r)==0)return r;let t=1;for(;t<r;)t<<=1;return t}var Ye=class r{length;static ofLength(t){return new r(Xt(t))}constructor(t){this.length=t,this.revIndex=Po(t),this.coefs=Co(t),this.copy=new yt(4,t),this.out=new yt(4,t),this.window=new Float32Array(t),this.window.fill(1)}revIndex;coefs;copy;out;window;setWindow(t){this.window.set(t)}transform(t,e){let i=this.length,[s,n]=this.out.get(i);if(s.fill(0),n.fill(0),e===void 0)for(let o=0;o<i&&o<t.length;++o){let a=this.revIndex[o];s[a]=this.window[o]*t[o]/i}else for(let o=0;o<i&&o<t.length&&o<e.length;++o){let a=this.revIndex[o];s[a]=this.window[o]*t[o]/i,n[a]=this.window[o]*e[o]/i}return Gr(this.length,!1,this.coefs,s,n),[s,n]}transformCircularBuffers(t,e){let i=this.length,[s,n]=this.copy.get(i);return t.copyTo(s),e.copyTo(n),this.transform(s,n)}reverse(t,e){let i=this.length,[s,n]=this.out.get(i);s.fill(0),n.fill(0);for(let o=0;o<i&&o<t.length&&o<e.length;++o){let a=this.revIndex[o];s[a]=t[o],n[a]=e[o]}return Gr(this.length,!0,this.coefs,s,n),[s,n]}};function Gr(r,t,e,i,s){let n=t?-1:1;for(let o=0;o<r;o+=4){let a=o,l=o+1,c=o+2,u=o+3,d=i[a],m=i[l],f=i[c],x=i[u],D=s[a],Et=s[l],At=s[c],It=s[u];i[a]=d+m+f+x,i[l]=d-m-n*(It-At),i[c]=d+m-f-x,i[u]=d-m+n*(It-At),s[a]=D+Et+At+It,s[l]=D-Et-n*(f-x),s[c]=D+Et-At-It,s[u]=D-Et+n*(f-x)}for(let o=8,a=0;o<=r;o*=2,++a){let l=e[a],c=o/2;for(let u=0;u<r;u+=o)for(let d=0;d<c;d+=4){let m=l.real[d],f=l.imag[d]*n,x=l.real[d+1],D=l.imag[d+1]*n,Et=l.real[d+2],At=l.imag[d+2]*n,It=l.real[d+3],rr=l.imag[d+3]*n,pe=u+d,Le=pe+c,nr=i[pe],or=i[Le],ar=s[pe],lr=s[Le],hr=m*or-f*lr,cr=m*lr+f*or;i[pe]=nr+hr,i[Le]=nr-hr,s[pe]=ar+cr,s[Le]=ar-cr;let fe=u+d+1,Ue=fe+c,dr=i[fe],ur=i[Ue],pr=s[fe],fr=s[Ue],mr=x*ur-D*fr,gr=x*fr+D*ur;i[fe]=dr+mr,i[Ue]=dr-mr,s[fe]=pr+gr,s[Ue]=pr-gr;let me=u+d+2,He=me+c,br=i[me],wr=i[He],yr=s[me],vr=s[He],xr=Et*wr-At*vr,Sr=Et*vr+At*wr;i[me]=br+xr,i[He]=br-xr,s[me]=yr+Sr,s[He]=yr-Sr;let ge=u+d+3,je=ge+c,_r=i[ge],Rr=i[je],Dr=s[ge],$r=s[je],Mr=It*Rr-rr*$r,Er=It*$r+rr*Rr;i[ge]=_r+Mr,i[je]=_r-Mr,s[ge]=Dr+Er,s[je]=Dr-Er}}}function Co(r){let t=Zr(r),e=[];for(let i=0,s=4;i<t;++i,s*=2){e.push({real:new Float32Array(s),imag:new Float32Array(s)});for(let n=0;n<s;++n){let o=-1*Math.PI*n/s;e[i].real[n]=Math.cos(o),e[i].imag[n]=Math.sin(o)}}return e}function Po(r){let t=Zr(r),e=new Int32Array(r);for(let i=0;i<r;++i)e[i]=To(i,t);return e}function Zr(r){let t=0;for(let e=r-1;e>0;e>>=1)++t;return t}function To(r,t){let e=0;for(let i=0;i<t;++i)e<<=1,e|=r&1,r>>=1;return e}var Io=null,Bo=!1;function Ht(){return Bo?null:Io}function ot(r,t,e){return new Float32Array(r.memory.buffer,t,e)}var De=class{constructor(t){this.ex=t;this.ptr=0;this.bytes=0}get(t){if(t>this.bytes){this.bytes>0&&this.ex.wrx_free(this.ptr,this.bytes);let e=Math.max(t,Math.ceil(this.bytes*1.5),4096);this.ptr=this.ex.wrx_alloc(e),this.bytes=e}return this.ptr}free(){this.bytes>0&&this.ex.wrx_free(this.ptr,this.bytes),this.ptr=0,this.bytes=0}};function et(r,t,e,i){let s=ot(r,t,i);if(e instanceof Float32Array)s.set(i===e.length?e:e.subarray(0,i));else for(let n=0;n<i;++n)s[n]=e[n]}var Yt=typeof FinalizationRegistry=="function"?new FinalizationRegistry(r=>{try{r()}catch{}}):null;var es=class{constructor(t,e){this.ex=t;this.length=e;let i=t.fft_new(e);this.handle=i,this.out=new yt(4,e),Yt?.register(this,()=>t.fft_free(i))}ex;length;handle;out;setWindow(t){let e=Math.min(t.length,this.length);ot(this.ex,this.ex.fft_window_ptr(this.handle),this.length).set(t.subarray(0,e))}collect(){let[t,e]=this.out.get(this.length);return t.set(ot(this.ex,this.ex.fft_out_re_ptr(this.handle),this.length)),e.set(ot(this.ex,this.ex.fft_out_im_ptr(this.handle),this.length)),[t,e]}transform(t,e){let i=this.ex,s=Math.min(this.length,t.length);return e!==void 0&&(s=Math.min(s,e.length)),et(i,i.fft_in_re_ptr(this.handle),t,s),e!==void 0&&et(i,i.fft_in_im_ptr(this.handle),e,s),i.fft_forward(this.handle,s,e!==void 0?1:0),this.collect()}transformCircularBuffers(t,e){let i=this.ex;return t.copyTo(ot(i,i.fft_in_re_ptr(this.handle),this.length)),e.copyTo(ot(i,i.fft_in_im_ptr(this.handle),this.length)),i.fft_forward(this.handle,this.length,1),this.collect()}reverse(t,e){let i=this.ex,s=Math.min(this.length,t.length,e.length);return et(i,i.fft_in_re_ptr(this.handle),t,s),et(i,i.fft_in_im_ptr(this.handle),e,s),i.fft_reverse(this.handle,s),this.collect()}},$e=class{static ofLength(t){let e=Ht();return e?new es(e,Xt(t)):Ye.ofLength(t)}};function Je(r,t){if(t==0&&r==0)return 0;let e=Math.abs(t)<Math.abs(r),i=e?t/r:r/t,s=i*i,n=i*(.9999993329+s*(-.3332985605+s*(.1994653599+s*(-.1390853351+s*(.0964200441+s*(-.0559098861+s*(.0218612288+s*-.004054058)))))));return e&&(i>=0?n=Math.PI/2-n:n=-Math.PI/2-n),t>=0?n:r>=0?n+Math.PI:n-Math.PI}var ti=class r{coefs;constructor(t){this.coefs=t,this.offset=this.coefs.length-1,this.center=Math.floor(this.coefs.length/2),this.pool=new F(2,2*this.offset),this.curSamples=this.pool.get(this.offset)}offset;center;pool;curSamples;setCoefficients(t){let e=this.curSamples;this.coefs=t,this.offset=this.coefs.length-1,this.center=Math.floor(this.coefs.length/2),this.curSamples=this.pool.get(this.offset),this.loadSamples(e)}clone(){return new r(this.coefs)}getDelay(){return this.center}inPlace(t){this.loadSamples(t);for(let e=0;e<t.length;++e)t[e]=this.get(e)}loadSamples(t){let e=t.length+this.offset;if(this.curSamples.length!=e){let i=this.pool.get(e);i.set(this.curSamples.subarray(this.curSamples.length-this.offset)),this.curSamples=i}else this.curSamples.copyWithin(0,t.length);this.curSamples.set(t,this.offset)}get(t){let e=0,i=0,s=this.coefs.length,n=4*Math.floor(s/4);for(;e<n;)i+=this.coefs[e++]*this.curSamples[t++]+this.coefs[e++]*this.curSamples[t++]+this.coefs[e++]*this.curSamples[t++]+this.coefs[e++]*this.curSamples[t++];let o=2*Math.floor(s/2);for(;e<o;)i+=this.coefs[e++]*this.curSamples[t++]+this.coefs[e++]*this.curSamples[t++];for(;e<s;)i+=this.coefs[e++]*this.curSamples[t++];return i}},X=class r{constructor(t){this.fft=$e.ofLength(t.length*2),this.kernel=this.computeKernel(t),this.overlap=t.length-1,this.input=new Ut(this.fft.length),this.input.fill(0,this.overlap),this.work=new Float32Array(this.fft.length),this.output=new Ut((this.fft.length-this.overlap)*2),this.output.fill(0,this.fft.length-this.overlap)}fft;kernel;overlap;input;work;output;computeKernel(t){let e=new Float32Array(this.fft.length),i=new Float32Array(this.fft.length);e.set(t),e.subarray(0,t.length).reverse();for(let n=0;n<e.length;++n)e[n]*=e.length;let s=this.fft.transform(e,i);return[new Float32Array(s[0]),new Float32Array(s[1])]}setCoefficients(t){let e=Xt(t.length*2),i=t.length-1;if(this.kernel=this.computeKernel(t),e==this.fft.length&&i==this.overlap)return;this.fft=$e.ofLength(e),this.overlap=i;let s=new Float32Array(this.input.available);this.input.moveTo(s),this.input=new Ut(this.fft.length),i>s.length&&this.input.fill(0,i-s.length),this.input.store(s),this.work=new Float32Array(this.fft.length),this.output=new Ut((this.fft.length-this.overlap)*2),this.output.fill(0,this.fft.length-this.overlap)}clone(){let t=new r(new Float32Array(this.overlap+1));return t.kernel=this.kernel,t}getDelay(){return this.fft.length-this.overlap/2}inPlace(t){let e=0,i=0;for(;t.length-e>0;){if(this.input.available<this.input.capacity){let s=Math.min(t.length-e,this.input.capacity-this.input.available);this.input.store(t.subarray(e,e+s)),e+=s}if(this.input.available==this.input.capacity){this.input.copyTo(this.work),this.input.consume(this.input.capacity-this.overlap);let s=this.fft.transform(this.work);for(let o=0;o<s[0].length;++o){let a=s[0][o],l=s[1][o],c=this.kernel[0][o],u=this.kernel[1][o];s[0][o]=a*c-l*u,s[1][o]=l*c+a*u}let n=this.fft.reverse(s[0],s[1]);this.output.store(n[0].subarray(this.overlap))}if(i<t.length){let s=this.output.moveTo(t.subarray(i,e));i+=s}}}},ut=class r{constructor(t){this.filterI=t.clone(),this.filterQ=t.clone()}filterI;filterQ;setCoefficients(t){this.filterI.setCoefficients(t),this.filterQ.setCoefficients(t)}clone(){return new r(this.filterI)}getDelay(){return this.filterI.getDelay()}inPlace(t,e){this.filterI.inPlace(t),this.filterQ.inPlace(e)}},ei=class r{constructor(t){this.buffer=new Float32Array(t),this.ptr=0}buffer;ptr;clone(){return new r(this.getDelay())}getDelay(){return this.buffer.length}inPlace(t){for(let e=0;e<t.length;++e){let i=t[e];t[e]=this.buffer[this.ptr],this.buffer[this.ptr]=i,this.ptr=(this.ptr+1)%this.buffer.length}}},Jt=class r{sampleRate;constructor(t,e,i){this.sampleRate=t,this.dcBlocker=new is(t),this.alpha=Ee(t,e),this.counter=0,this.maxPower=0,this.maxGain=i||100}dcBlocker;alpha;counter;maxPower;maxGain;clone(){let t=new r(this.sampleRate,1,this.maxGain);return t.alpha=this.alpha,t}getDelay(){return 0}inPlace(t){let e=this.alpha,i=this.maxPower,s=this.counter,n;this.dcBlocker.inPlace(t);for(let o=0;o<t.length;++o){let a=t[o],l=a*a;l>.9*i?(s=this.sampleRate,l>i&&(i=l)):s>0?--s:i-=e*i,n=Math.min(this.maxGain,1/Math.sqrt(i)),t[o]*=n}this.maxPower=i,this.counter=s}},is=class r{constructor(t){this.alpha=Ee(t,.5),this.dc=0}alpha;dc;clone(){let t=new r(1e3);return t.alpha=this.alpha,t.dc=this.dc,t}getDelay(){return 0}inPlace(t){let e=this.alpha,i=this.dc;for(let s=0;s<t.length;++s)i+=e*(t[s]-i),t[s]-=i;this.dc=i}};function Ee(r,t){return 1-Math.exp(-1/(r*t))}var ss=class r{sampleRate;constructor(t,e,i,s){this.sampleRate=t,this.q=[e,i,s],this.v=[0,0]}q;v;clone(){return new r(this.sampleRate,...this.q)}getDelay(){return 0}inPlace(t){let e=this.q,i=this.v[0],s=this.v[1];for(let n=0;n<t.length;++n){let o=t[n];t[n]=s=e[0]*o+e[1]*i+e[2]*s,i=o}this.v[0]=i,this.v[1]=s}},rs=class r{sampleRate;constructor(t,e,i,s,n,o){this.sampleRate=t,this.q=[e,i,s,n,o],this.v=[0,0,0,0]}q;v;clone(){return new r(this.sampleRate,...this.q)}getDelay(){return 0}inPlace(t){let e=this.q,i=this.v[0],s=this.v[1],n=this.v[2],o=this.v[3];for(let a=0;a<t.length;++a){let l=t[a],c=t[a]=e[0]*l+e[1]*i+e[2]*s+e[3]*n+e[4]*o;o=n,n=c,s=i,i=l}this.v[0]=i,this.v[1]=s,this.v[2]=n,this.v[3]=o}};function qo(r,t){let e=2*Math.PI*t/r,s=1/(2*r*Math.tan(e/2)),n=1+2*s*r,o=1-2*s*r;return[1/n,1/n,-o/n]}function No(r,t,e){let i=2*Math.PI*t/r,s=Math.sin(i)/(2*e),n=(1-Math.cos(i))/2,o=1-Math.cos(i),a=(1-Math.cos(i))/2,l=1+s,c=-2*Math.cos(i),u=1-s;return[n/l,o/l,a/l,-c/l,-u/l]}var Me=class extends ss{constructor(t,e){super(t,...qo(t,1/(2*Math.PI*e)))}};var ns=class extends rs{constructor(t,e,i){super(t,...No(t,e,i))}},V=class{sampleRate;constructor(t){this.sampleRate=t,this.cosine=1,this.sine=0}cosine;sine;inPlace(t,e,i){let s=this.cosine,n=this.sine,o=Math.cos(2*Math.PI*i/this.sampleRate),a=Math.sin(2*Math.PI*i/this.sampleRate);for(let l=0;l<t.length;++l){let c=t[l]*s-e[l]*n;e[l]=t[l]*n+e[l]*s,t[l]=c;let u=s*a+n*o;s=s*o-n*a,n=u}this.cosine=s,this.sine=n}},ii=class{sampleRate;targetFreq;constructor(t,e,i){this.sampleRate=t,this.targetFreq=e,this.iqPool=new yt(2),this.downShifter=new V(t),this.upShifter=new V(t),this.filterI=new ns(t,i*100,1),this.filterQ=this.filterI.clone(),this.prev=[1,0],this.tolerance=2*Math.PI*i/t,this.speedEstimate=0,this.speedDecay=Ee(t,.25),this.isLocked=!1}iqPool;downShifter;upShifter;filterI;filterQ;prev;tolerance;speedEstimate;speedDecay;isLocked;get locked(){return this.isLocked}extract(t){let e=this.speedDecay,i=this.prev[0],s=this.prev[1],n=this.speedEstimate,o=this.iqPool.get(t.length),a=o[0],l=o[1];a.set(t),l.fill(0),this.downShifter.inPlace(a,l,-this.targetFreq),this.filterI.inPlace(a),this.filterQ.inPlace(l);for(let c=0;c<a.length;++c){let u=Math.hypot(a[c],l[c]);u>0?(a[c]/=u,l[c]/=u,n+=e*(Je(l[c]*i-a[c]*s,a[c]*i+l[c]*s)-n)):n+=e*(2*this.tolerance-n),i=a[c],s=l[c]}return this.upShifter.inPlace(a,l,this.targetFreq),this.prev[0]=i,this.prev[1]=s,this.speedEstimate=n,this.isLocked=n>=-this.tolerance&&n<=this.tolerance,o}};var Kr=null,Qr=null,Xr=null;function Yr(r){Kr!==r&&(Kr=r,Qr=new De(r),Xr=new De(r))}function Ct(r,t){return Yr(r),Qr.get(t)}function Jr(r,t){return Yr(r),Xr.get(t)}var os=class{constructor(t,e){this.ex=t;this.coefs=e;let i=Ct(t,e.length*4);et(t,i,e,e.length);let s=t.fir_new(i,e.length);this.handle=s,Yt?.register(this,()=>t.fir_free(s))}ex;coefs;handle;setCoefficients(t){this.coefs=t;let e=Ct(this.ex,t.length*4);et(this.ex,e,t,t.length),this.ex.fir_set_coefs(this.handle,e,t.length)}clone(){return new L(this.coefs)}getDelay(){return Math.floor(this.coefs.length/2)}inPlace(t){let e=t.length;if(e===0)return;let i=Ct(this.ex,e*4);et(this.ex,i,t,e),this.ex.fir_in_place(this.handle,i,e),t.set(ot(this.ex,i,e))}loadSamples(t){let e=t.length,i=Ct(this.ex,Math.max(4,e*4));et(this.ex,i,t,e),this.ex.fir_load(this.handle,i,e)}get(t){return this.ex.fir_get(this.handle,t)}},L=class extends ti{constructor(t){let e=Ht();if(e)return new os(e,t);super(t)}};var vt;(function(r){r[r.Upper=0]="Upper",r[r.Lower=1]="Lower"})(vt||(vt={}));var si=class{constructor(t,e,i){let s=Vr(e);this.filterHilbert=i?.useFftFilter?new X(s):new L(s),this.filterDelay=new ei(this.filterHilbert.getDelay()),this.hilbertMul=t==vt.Upper?-1:1}filterHilbert;filterDelay;hilbertMul;setSideband(t){this.hilbertMul=t==vt.Upper?-1:1}demodulate(t,e,i){this.filterDelay.inPlace(t),this.filterHilbert.inPlace(e);for(let s=0;s<i.length;++s)i[s]=(t[s]+e[s]*this.hilbertMul)/2}},ri=class{constructor(t){this.alpha=Ee(t,.5),this.carrierAmplitude=0}alpha;carrierAmplitude;demodulate(t,e,i){let s=this.alpha,n=this.carrierAmplitude;for(let o=0;o<i.length;++o){let a=t[o],l=e[o],c=a*a+l*l,u=Math.sqrt(c);n+=s*(u-n),i[o]=n==0?0:u/n-1}this.carrierAmplitude=n}},te=class{constructor(t){this.mul=1/(2*Math.PI*t),this.lI=0,this.lQ=0}mul;lI;lQ;setMaxDeviation(t){this.mul=1/(2*Math.PI*t)}demodulate(t,e,i){let s=this.mul,n=this.lI,o=this.lQ;for(let a=0;a<t.length;++a){let l=n*t[a]+o*e[a],c=n*e[a]-t[a]*o;n=t[a],o=e[a],i[a]=Je(c,l)*s}this.lI=n,this.lQ=o}},ni=class{constructor(t,e){this.pool=new F(4),this.detector=new ii(t,e,2)}pool;detector;separate(t){let e=this.pool.get(t.length),i=this.detector.extract(t),s=i[0],n=i[1];for(let o=0;o<t.length;++o)e[o]=t[o]*s[o]*n[o]*4;return{found:this.detector.locked,diff:e}}};function G(r,t){let e=0;for(let i=0;i<r.length;++i){let s=r[i],n=t[i];e+=s*s+n*n}return e/r.length}var as=class{ratio;constructor(t,e){this.ratio=t,this.filter=e.clone(),this.pool=new F(2)}filter;pool;downsample(t){let e=this.ratio,i=Math.floor(t.length/e),s=this.pool.get(i);this.filter.loadSamples(t);for(let n=0;n<i;++n)s[n]=this.filter.get(Math.floor(n*e));return s}getDelay(){return this.filter.getDelay()}};function ls(r,t,e){let i=r/t,s=e;return typeof s=="number"&&(s=q(r,t/2,s)),new as(i,new L(s))}var oi=class{constructor(t,e,i){this.downsampler=ls(t,e,i)}downsampler;downsample(t){return this.downsampler.downsample(t)}getDelay(){return this.downsampler.getDelay()}},ai=class{constructor(t,e,i){this.downsamplerI=ls(t,e,i),this.downsamplerQ=ls(t,e,i)}downsamplerI;downsamplerQ;downsample(t,e){return[this.downsamplerI.downsample(t),this.downsamplerQ.downsample(e)]}getDelay(){return this.downsamplerI.getDelay()}};var Ae=class{constructor(t,e,i){this.ex=t;this.ratio=e;let s=Ct(t,i.length*4);et(t,s,i,i.length);let n=t.fir_new(s,i.length);this.handle=n,this.delay=Math.floor(i.length/2),Yt?.register(this,()=>t.fir_free(n))}ex;ratio;handle;pool=new F(2);delay;downsample(t){let e=this.ex,i=t.length,s=Math.floor(i/this.ratio),n=this.pool.get(s),o=Ct(e,Math.max(4,i*4)),a=Jr(e,Math.max(4,s*4));et(e,o,t,i);let l=e.fir_downsample(this.handle,o,i,this.ratio,a,s);return n.set(ot(e,a,l)),n}getDelay(){return this.delay}};function tn(r,t,e){return typeof e=="number"?q(r,t/2,e):e}var Fe=class extends oi{wasm;constructor(t,e,i){let s=Ht();if(!s){super(t,e,i);return}super(t,e,new Float32Array(1)),this.wasm=new Ae(s,t/e,tn(t,e,i))}downsample(t){return this.wasm?this.wasm.downsample(t):super.downsample(t)}getDelay(){return this.wasm?this.wasm.getDelay():super.getDelay()}},st=class extends ai{wasmI;wasmQ;constructor(t,e,i){let s=Ht();if(!s){super(t,e,i);return}super(t,e,new Float32Array(1));let n=tn(t,e,i);this.wasmI=new Ae(s,t/e,n),this.wasmQ=new Ae(s,t/e,n)}downsample(t,e){return this.wasmI&&this.wasmQ?[this.wasmI.downsample(t),this.wasmQ.downsample(e)]:super.downsample(t,e)}getDelay(){return this.wasmI?this.wasmI.getDelay():super.getDelay()}};var li=class{outRate;mode;constructor(t,e,i,s){this.outRate=e,this.mode=i;let n=s?.downsamplerTaps||151;this.rfTaps=s?.rfTaps||151,this.shifter=new V(t),this.downsampler=new st(t,e,n);let o=q(e,this.mode.bandwidth/2,this.rfTaps);this.filter=new ut(s?.useFftFilter?new X(o):new L(o)),this.demodulator=new ri(e),this.outPool=new F(1)}rfTaps;shifter;downsampler;filter;demodulator;outPool;getMode(){return this.mode}setMode(t){this.mode=t;let e=q(this.outRate,t.bandwidth/2,this.rfTaps);this.filter.setCoefficients(e)}demodulate(t,e,i){this.shifter.inPlace(t,e,-i);let[s,n]=this.downsampler.downsample(t,e),o=G(s,n);this.filter.inPlace(s,n);let a=G(s,n)*this.outRate/this.mode.bandwidth;this.demodulator.demodulate(s,n,s);let l=this.outPool.get(s.length);return l.set(s),{left:s,right:l,stereo:!1,snr:a/o}}},hi=class extends it{constructor(t){super(t)}create(){return{scheme:"AM",bandwidth:15e3,squelch:0}}hasBandwidth(){return!0}getBandwidth(){return this.mode.bandwidth}setBandwidth(t){return this.mode={...this.mode,bandwidth:Math.max(250,Math.min(t,3e4))},this}hasSquelch(){return!0}getSquelch(){return this.mode.squelch}setSquelch(t){return this.mode={...this.mode,squelch:Math.max(0,Math.min(t,6))},this}};var ci=class{outRate;mode;constructor(t,e,i,s){this.outRate=e,this.mode=i;let n=s?.downsamplerTaps||151;this.audioTaps=s?.audioTaps||351;let o=s?.toneFrequency||600;this.shifter=new V(t),this.downsampler=new st(t,e,n);let a=q(e,i.bandwidth/2,this.audioTaps);this.filter=new ut(s?.useFftFilter?new X(a):new L(a)),this.toneShifter=new V(e),this.toneFrequency=o,this.agc=new Jt(e,10),this.outPool=new F(1)}audioTaps;shifter;downsampler;filter;toneShifter;toneFrequency;agc;outPool;getMode(){return this.mode}setMode(t){this.mode=t;let e=q(this.outRate,t.bandwidth/2,this.audioTaps);this.filter.setCoefficients(e)}demodulate(t,e,i){this.shifter.inPlace(t,e,-i);let[s,n]=this.downsampler.downsample(t,e),o=G(s,n);this.filter.inPlace(s,n);let a=G(s,n)*this.outRate/this.mode.bandwidth;this.toneShifter.inPlace(s,n,this.toneFrequency),this.agc.inPlace(s);let l=this.outPool.get(s.length);return l.set(s),{left:s,right:l,stereo:!1,snr:a/o}}},di=class extends it{constructor(t){super(t)}create(){return{scheme:"CW",bandwidth:50}}hasBandwidth(){return!0}getBandwidth(){return this.mode.bandwidth}setBandwidth(t){return this.mode={...this.mode,bandwidth:Math.max(5,Math.min(t,1e3))},this}};var ui=class{outRate;mode;constructor(t,e,i,s){this.outRate=e,this.mode=i;let n=s?.downsamplerTaps||151;this.rfTaps=s?.rfTaps||151,this.shifter=new V(t),this.downsampler=new st(t,e,n);let o=q(e,i.maxF,this.rfTaps);this.filter=new ut(s?.useFftFilter?new X(o):new L(o)),this.demodulator=new te(i.maxF/e),this.outPool=new F(1)}rfTaps;shifter;downsampler;filter;demodulator;outPool;getMode(){return this.mode}setMode(t){this.mode=t;let e=q(this.outRate,t.maxF,this.rfTaps);this.filter.setCoefficients(e),this.demodulator.setMaxDeviation(t.maxF/this.outRate)}demodulate(t,e,i){this.shifter.inPlace(t,e,-i);let[s,n]=this.downsampler.downsample(t,e),o=G(s,n);this.filter.inPlace(s,n);let a=G(s,n)*this.outRate/(this.mode.maxF*2);this.demodulator.demodulate(s,n,s);let l=this.outPool.get(s.length);return l.set(s),{left:s,right:l,stereo:!1,snr:a/o}}},pi=class extends it{constructor(t){super(t)}create(){return{scheme:"NBFM",maxF:5e3,squelch:0}}hasBandwidth(){return!0}getBandwidth(){return 2*this.mode.maxF}setBandwidth(t){return this.mode={...this.mode,maxF:Math.max(125,Math.min(t/2,15e3))},this}hasSquelch(){return!0}getSquelch(){return this.mode.squelch}setSquelch(t){return this.mode={...this.mode,squelch:Math.max(0,Math.min(t,6))},this}};var Ce=class{outRate;mode;constructor(t,e,i,s){this.outRate=e,this.mode=i;let n=s?.downsamplerTaps||151;this.rfTaps=s?.rfTaps||151;let o=s?.hilbertTaps||151;this.shifter=new V(t),this.downsampler=new st(t,e,n);let a=q(this.outRate,i.bandwidth/2,this.rfTaps);this.filter=s?.useFftFilter?new X(a):new L(a),this.demodulator=new si(i.scheme=="USB"?vt.Upper:vt.Lower,o,{useFftFilter:s?.useFftFilter}),this.agc=new Jt(e,3),this.outPool=new F(1)}rfTaps;shifter;downsampler;filter;demodulator;agc;outPool;getMode(){return this.mode}setMode(t){this.mode=t;let e=q(this.outRate,t.bandwidth/2,this.rfTaps);this.filter.setCoefficients(e),this.demodulator.setSideband(t.scheme=="USB"?vt.Upper:vt.Lower)}demodulate(t,e,i){this.shifter.inPlace(t,e,-i);let[s,n]=this.downsampler.downsample(t,e),o=G(s,n);this.demodulator.demodulate(s,n,s),this.filter.inPlace(s);let a=G(s,s)*this.outRate/(this.mode.bandwidth*2);this.agc.inPlace(s);let l=this.outPool.get(s.length);return l.set(s),{left:s,right:l,stereo:!1,snr:a/o}}},Pe=class extends it{constructor(t){super(t)}create(t){return{scheme:t,bandwidth:2800,squelch:0}}hasBandwidth(){return!0}getBandwidth(){return this.mode.bandwidth}setBandwidth(t){return this.mode={...this.mode,bandwidth:Math.max(10,Math.min(t,15e3))},this}hasSquelch(){return!0}getSquelch(){return this.mode.squelch}setSquelch(t){return this.mode={...this.mode,squelch:Math.max(0,Math.min(t,6))},this}};var fi=class{mode;constructor(t,e,i,s){this.mode=i;let n=Math.min(t,336e3);this.stage1=new hs(t,n,i,s),this.stage2=new cs(n,e,i,s)}stage1;stage2;getMode(){return this.mode}setMode(t){this.mode=t,this.stage1.setMode(t),this.stage2.setMode(t)}demodulate(t,e,i){let s=this.stage1.demodulate(t,e,i),n=this.stage2.demodulate(s.left);return n.snr=s.snr,n}},hs=class{outRate;mode;constructor(t,e,i,s){this.outRate=e,this.mode=i;let n=75e3,o=s?.downsamplerTaps||151,a=s?.rfTaps||151;this.shifter=new V(t),t!=e&&(this.downsampler=new st(t,e,o));let l=q(e,n,a);this.filter=new ut(s?.useFftFilter?new X(l):new L(l)),this.demodulator=new te(n/e)}shifter;downsampler;filter;demodulator;getMode(){return this.mode}setMode(t){this.mode=t}demodulate(t,e,i){this.shifter.inPlace(t,e,-i);let[s,n]=this.downsampler?this.downsampler.downsample(t,e):[t,e],o=G(s,n);this.filter.inPlace(s,n);let a=G(s,n)*this.outRate/15e4;return this.demodulator.demodulate(s,n,s),{left:s,right:new Float32Array(s),stereo:!1,snr:a/o}}},cs=class{mode;constructor(t,e,i,s){this.mode=i;let n=19e3,o=(s?.deemphasizerTc===void 0?50:s.deemphasizerTc)/1e6,a=s?.audioTaps||41,l=Math.min(15e3,e/2),c=q(t,l,a,1/.9);this.monoSampler=new Fe(t,e,c),this.stereoSampler=new Fe(t,e,c),this.stereoSeparator=new ni(t,n),this.leftDeemph=new Me(e,o),this.rightDeemph=new Me(e,o),this.outPool=new F(2,1024)}monoSampler;stereoSampler;stereoSeparator;leftDeemph;rightDeemph;outPool;getMode(){return this.mode}setMode(t){this.mode=t}demodulate(t){let e=this.monoSampler.downsample(t);if(this.mode.stereo){let s=this.stereoSeparator.separate(t);if(s.found){let n=this.stereoSampler.downsample(s.diff),o=this.outPool.get(e.length),a=e;for(let l=0;l<n.length;++l)o[l]=e[l]-n[l],a[l]=e[l]+n[l];return this.leftDeemph.inPlace(o),this.rightDeemph.inPlace(a),{left:o,right:a,stereo:!0,snr:1}}}this.leftDeemph.inPlace(e);let i=this.outPool.get(e.length);return i.set(e),{left:e,right:i,stereo:!1,snr:1}}},mi=class extends it{constructor(t){super(t)}create(){return{scheme:"WBFM",stereo:!0}}hasStereo(){return!0}getStereo(){return this.mode.stereo}setStereo(t){return this.mode={...this.mode,stereo:t},this}getBandwidth(){return 15e4}};Lt("WBFM",fi,mi);Lt("NBFM",ui,pi);Lt("AM",li,hi);Lt("USB",Ce,Pe);Lt("LSB",Ce,Pe);Lt("CW",ci,di);function H(r,t){return p`<svg version="1.1" width="16" height="16">
    <title>${r}</title>
    ${t}
  </svg>`}var en=H("Close",B`<g><path d="M2 4v-2h2l4 4 4 -4h2v2l-4 4 4 4v2h-2l-4 -4 -4 4h-2v-2l4 -4z"></path></g>`),sn=H("Resize",B`<g><path d="M2,2V8L4.25,5.75 10.25,11.75 8,14 14,14 14,8 11.75,10.25 5.75,4.25 8,2Z"></path></g>`),gi=H("Stop playing",B`<g><path d="M3 3v10h10V3z"></path></g>`),bi=H("Start playing",B`<g><path d="M3 2v12l10 -6z"></path></g>`),wi=H("Settings",B`<g><path d="M5 1A4 4 0 0 0 3.7 1.2L6.5 4 6 6 4 6.5 1.2 3.7A4 4 0 0 0 1 5 4 4 0 0 0 5 9 4 4 0 0 0 6.6 8.6L12.5 14.5A1.4 1.4 0 0 0 13.6 15 1.4 1.4 0 0 0 15 13.6 1.4 1.4 0 0 0 14.5 12.5L8.6 6.6A4 4 0 0 0 9 5 4 4 0 0 0 5 1z"></path></g>`),rn=H("Help",B`<g>
    <path
      d="M8 1A5 4.5 0 0 0 3 5.5L3 6L5 6L5 5.5A3 2.5 0 0 1 8 3A3 2.5 0 0 1 11 5.5A3 2.5 0 0 1 8 8L7 8L7 9L7 10L7 12L9 12L9 10A5 4.5 0 0 0 13 5.5A5 4.5 0 0 0 8 1z"
    ></path>
    <circle cy="14" cx="8" r="1"></circle>
  </g>`),yi=H("Scroll left",B`<g><path d="m11 2v2l-4 4 4 4v2H9L3 8 9 2Z"></path></g>`),vi=H("Scroll right",B`<g><path d="m5 2v2l4 4 -4 4v2h2L13 8 7 2Z"></path></g>`);function nn(r,t){return H(r,B`<g>
        <path
          d="M7 1A6 6 0 0 0 1 7A6 6 0 0 0 7 13A6 6 0 0 0 13 7A6 6 0 0 0 7 1zM7 3A4 4 0 0 1 11 7A4 4 0 0 1 7 11A4 4 0 0 1 3 7A4 4 0 0 1 7 3z"
        ></path>
        <path d="M14.5 13l-1.5 1.5 -4 -4 1.5 -1.5z"></path>
        ${t}
      </g>`)}var xi=nn("Zoom in",B`<path d="M4 6v2h2v2h2v-2h2v-2h-2v-2h-2v2Z"></path>`),Si=nn("Zoom out",B`<path d="M4 6v2h6v-2Z"></path>`),on=H("Stereo",B`<g><path d="M6 3A5 5 0 0 0 1 8A5 5 0 0 0 6 13A5 5 0 0 0 8 13A5 5 0 0 0 10 13A5 5 0 0 0 15 8A5 5 0 0 0 10 3A5 5 0 0 0 8 3A5 5 0 0 0 6 3zM6 5A3 3 0 0 1 9 8A3 3 0 0 1 6 11A3 3 0 0 1 3 8A3 3 0 0 1 6 5zM10 5A3 3 0 0 1 13 8A3 3 0 0 1 10 11A3 3 0 0 1 10 11A5 5 0 0 0 11 8A5 5 0 0 0 10 5z"></g>`),an=H("Reload",B`<g>
    <path d="M8 1A7 7 0 0 0 1 8A7 7 0 0 0 15 8h-2A5 5 0 0 1 3 8A5 5 0 0 1 12 5h-3v2h6v-6h-2v2A7 7 0 0 0 8 1z"></path>
  </g>`),Te=H("Add",B`<g><path d="M2,7h5v-5h2v5h5v2h-5v5h-2v-5h-5z"></path></g>`),_i=H("Edit",B`<g><path d="M1.9,15.37A1,1 0 0 1 0.63,14.1L2,10 12,0 16,4 6,14ZM2,14 5,13 3,11ZM6,12 14,4 12,2 4,10Z"></path></g>`),Ri=H("Delete",B`<g><path d="M2 2h1l5 5 5 -5h1v1l-5 5 5 5v1h-1l-5 -5 -5 5h-1v-1l5 -5l-5 -5z"></path></g>`),zh=H("Update",B`<g><path d="M1 1L3 3A7 7 0 0 0 1 8A7 7 0 0 0 8 15v-2A5 5 0 0 1 3 8A5 5 0 0 1 4.5 4.5L7 7v-6h-6zM8 1v2A5 5 0 0 1 13 8A5 5 0 0 1 11.5 11.5L9 9v6h6L13 13A7 7 0 0 0 15 8A7 7 0 0 0 8 1z"></path></g>`),Di=H("Presets",B`<g><path d="M1,1h6v6h-6zM3,3v2h2v-2zM9,1h6v6h-6zM11,3v2h2v-2zM1,9h6v6h-6zM3,11v2h2v-2zM9,9h6v6h-6zM11,11v2h2v-2z"></path></g>`),ln=p`<svg version="1.1" width="10" height="9">
  <g><path d="M1,8h8l-4,-6z"></path></g>
</svg>`,hn=p`<svg version="1.1" width="10" height="9">
  <g><path d="M1,1h8l-4,6z"></path></g>
</svg>`;var ie=class extends CustomEvent{constructor(t){super("spectrum-tap",{detail:t,bubbles:!0,composed:!0})}},jt=class extends CustomEvent{constructor(t){super("spectrum-drag",{detail:t,bubbles:!0,composed:!0})}},$i=class extends CustomEvent{constructor(t){super("spectrum-highlight-changed",{detail:t,bubbles:!0,composed:!0})}},Wt=class extends CustomEvent{constructor(t){super("spectrum-zoom",{detail:t,bubbles:!0,composed:!0})}},ke=class extends CustomEvent{constructor(t){super("spectrum-decibel-range-changed",{detail:t,bubbles:!0,composed:!0})}};var Y=class{constructor(t,e,i,s,n){this.width=e;this.bins=i;this.centerFreq=s;this.bandwidth=n;this.leftBin=Math.floor(t.leftFraction*i),this.visibleBins=Math.floor(t.spanFraction*i),this.leftFrequency=this.binNumberToFrequency(this.leftBin-.5),this.rightFrequency=this.binNumberToFrequency(this.leftBin+this.visibleBins-.5)}zoomed(t){return(t*this.bins-this.leftBin+.5)/this.visibleBins}unzoomed(t){return(this.leftBin+this.visibleBins*t-.5)/this.bins}screenBinToFftBin(t){return(t+this.bins/2)%this.bins}leftCoordToBinNumber(t){return Math.round(this.leftBin+t*this.visibleBins/this.width)}binNumberToCenterCoord(t){return this.width*(t+.5-this.leftBin)/this.visibleBins}binNumberToFrequency(t){return this.centerFreq&&this.bandwidth?this.centerFreq+this.bandwidth*(t/this.bins-.5):this.centerFreq||0}};var cn=1,dn=16,S=class r{constructor(t,e){t===void 0&&(t=1),e===void 0&&(e=.5),t<cn&&(t=cn),t>dn&&(t=dn);let i=1/(2*t);e-i<0&&(e=i),e+i>1&&(e=1-i),this.center=e,this.level=t}zoomed(t){return .5+this.level*(t-this.center)}unzoomed(t){return this.center+(t-.5)/this.level}get leftFraction(){return this.center-1/(2*this.level)}get rightFraction(){return this.center+1/(2*this.level)}get spanFraction(){return 1/this.level}isVisible(t){let e=this.zoomed(t);return 0<=e&&e<1}withCenter(t){return new r(this.level,t)}withMovedCenter(t){return this.withCenter(this.center+t)}withLevel(t){return new r(t,this.center)}withLevelInContext(t,e){let i=this.zoomed(e);if(i<0||i>=1)return this.withLevel(t);let s=e+(.5-i)/t;return new r(t,s)}},U=new S;var se=function(r,t,e,i){var s=arguments.length,n=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(t,e,n):o(t,e))||n);return s>3&&n&&Object.defineProperty(t,e,n),n},re=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},un,pn,pt=class extends w{static get styles(){return[b`
        #scope {
          color: var(--rr-scope-color, yellow);
          width: 100%;
          height: 100%;
        }
      `]}render(){return p`<canvas id="scope"></canvas>`}constructor(){super(),this.minDecibels=-100,this.maxDecibels=-30,this.fftSize=2048,this.zoom=U,this.spectrum=new Float32Array(this.fftSize),this.width=this.fftSize,this.addEventListener("click",t=>this.onClick(t))}addFloatSpectrum(t){this.fftSize!=t.length&&(this.fftSize=t.length,this.spectrum=new Float32Array(this.fftSize)),this.spectrum.set(t),this.redraw()}updated(t){super.updated(t),t.has("zoom")&&this.redraw()}redraw(){let t=this.getContext();if(!t)return;let e=t.canvas.offsetWidth,i=t.canvas.offsetHeight;t.canvas.width!=e&&(t.canvas.width=e),t.canvas.height!=i&&(t.canvas.height=i),this.width!=e&&(this.width=e);let s=this.minDecibels,n=this.maxDecibels,o=n-s,a=(1-i)/o;t.clearRect(0,0,t.canvas.width,t.canvas.height),t.strokeStyle=getComputedStyle(this.canvas).getPropertyValue("color"),t.beginPath();let l=new Y(this.zoom,this.width,this.fftSize),c=u=>(this.spectrum[l.screenBinToFftBin(u)]-n)*a;if(l.visibleBins<=e){let u=d=>l.binNumberToCenterCoord(d);t.moveTo(u(l.leftBin-1),c(l.leftBin-1));for(let d=0;d<l.visibleBins+1;++d)t.lineTo(u(l.leftBin+d),c(l.leftBin+d))}else for(let u=0;u<e;++u){let d=l.leftCoordToBinNumber(u),m=l.leftCoordToBinNumber(u+1),f=c(d);for(let x=d+1;x<m;++x)f=Math.min(f,c(x));u==0?t.moveTo(u,f):t.lineTo(u,f)}t.stroke()}onClick(t){let i=new Y(this.zoom,this.width,this.fftSize).unzoomed(t.offsetX/this.offsetWidth);this.dispatchEvent(new ie({fraction:i,target:"scope"})),t.preventDefault()}getContext(){if(this.context)return this.context;if(this.canvas)return this.canvas.width=this.fftSize,this.canvas.height=this.maxDecibels-this.minDecibels,this.context=this.canvas.getContext("2d"),this.context}};se([h({type:Number,reflect:!0,attribute:"min-decibels"}),re("design:type",Number)],pt.prototype,"minDecibels",void 0);se([h({type:Number,reflect:!0,attribute:"max-decibels"}),re("design:type",Number)],pt.prototype,"maxDecibels",void 0);se([h({type:Number,reflect:!0}),re("design:type",Number)],pt.prototype,"fftSize",void 0);se([h({attribute:!1}),re("design:type",typeof(un=typeof S<"u"&&S)=="function"?un:Object)],pt.prototype,"zoom",void 0);se([v("#scope"),re("design:type",typeof(pn=typeof HTMLCanvasElement<"u"&&HTMLCanvasElement)=="function"?pn:Object)],pt.prototype,"canvas",void 0);pt=se([y("rr-scope-line"),re("design:paramtypes",[])],pt);var xt=function(r,t,e,i){var s=arguments.length,n=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(t,e,n):o(t,e))||n);return s>3&&n&&Object.defineProperty(t,e,n),n},St=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},fn,mn,ft=class extends w{static get styles(){return[b`
        canvas {
          color: var(--rr-captions-color, rgba(255, 255, 255, 0.5));
          width: 100%;
          height: 100%;
        }
      `]}render(){return p`<canvas id="canvas"></canvas>`}constructor(){super(),this.centerFrequency=0,this.frequencyScale=1,this.minDecibels=-100,this.maxDecibels=-30,this.fftSize=2048,this.zoom=U,this.resizeObserver=new ResizeObserver(()=>this.redraw())}connectedCallback(){super.connectedCallback(),this.resizeObserver?.disconnect(),this.resizeObserver.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.resizeObserver?.disconnect()}firstUpdated(t){super.firstUpdated(t),this.redraw()}updated(t){super.updated(t),!(t.size==0||t.size==1&&t.has("lines"))&&this.redraw()}redraw(){let t=this.getContext();if(!t)return;let e=t.canvas;e.width!=e.offsetWidth&&(e.width=this.offsetWidth),e.height!=e.offsetHeight&&(e.height=this.offsetHeight);let i=e.width,s=e.height,n=16,o=24,a=getComputedStyle(t.canvas).getPropertyValue("color"),l=this.computeLines(i-o,s-n);t.clearRect(0,0,i,s),t.save(),t.fillStyle=a;for(let{position:c,value:u,horizontal:d}of l){let[m,f]=[o+c*(i-o),n+c*(s-n)],x=String(d?u:u/(this.frequencyScale||1));if(d){t.textBaseline="middle",t.textAlign="right",m=o-2;let D=t.measureText(x);f-D.actualBoundingBoxAscent<n&&(f=D.actualBoundingBoxAscent+n),f+D.actualBoundingBoxDescent>s&&(f=s-D.actualBoundingBoxDescent)}else{t.textBaseline="bottom",t.textAlign="center",f=n-2;let D=t.measureText(x);m-D.actualBoundingBoxLeft<o&&(m=D.actualBoundingBoxLeft+o),m+D.actualBoundingBoxRight>i&&(m=i-D.actualBoundingBoxRight)}t.fillText(x,m,f)}t.restore(),t.save(),t.strokeStyle=a,t.beginPath();for(let{position:c,horizontal:u}of l)if(u){let d=n+c*(s-n);t.moveTo(o,d),t.lineTo(i,d)}else{let d=o+c*(i-o);t.moveTo(d,n),t.lineTo(d,s)}t.stroke(),t.restore()}getContext(){if(this.context)return this.context;if(this.canvas)return this.context=this.canvas.getContext("2d"),this.context}computeLines(t,e){let i=[];if(this.minDecibels!==void 0&&this.maxDecibels!==void 0&&i.push(...gn(this.minDecibels,this.maxDecibels,20,25,e,Ie.Descending,Be.Horizontal,[1,2,3,5,6,10])),this.bandwidth!==void 0){let s=new Y(this.zoom,1,this.fftSize,this.centerFrequency,this.bandwidth);i.push(...gn(s.leftFrequency,s.rightFrequency,50,80,t,Ie.Ascending,Be.Vertical))}else{let s=this.zoom.zoomed(.5);s>=0&&s<=1&&i.push({value:this.centerFrequency,position:s,horizontal:!1})}return i}};xt([h({type:Number,reflect:!0}),St("design:type",Number)],ft.prototype,"bandwidth",void 0);xt([h({type:Number,reflect:!0,attribute:"center-frequency"}),St("design:type",Number)],ft.prototype,"centerFrequency",void 0);xt([h({type:Number,reflect:!0,attribute:"frequency-scale"}),St("design:type",Number)],ft.prototype,"frequencyScale",void 0);xt([h({type:Number,reflect:!0,attribute:"min-decibels"}),St("design:type",Number)],ft.prototype,"minDecibels",void 0);xt([h({type:Number,reflect:!0,attribute:"max-decibels"}),St("design:type",Number)],ft.prototype,"maxDecibels",void 0);xt([h({type:Number,reflect:!0}),St("design:type",Number)],ft.prototype,"fftSize",void 0);xt([h({attribute:!1}),St("design:type",typeof(fn=typeof S<"u"&&S)=="function"?fn:Object)],ft.prototype,"zoom",void 0);xt([v("#canvas"),St("design:type",typeof(mn=typeof HTMLCanvasElement<"u"&&HTMLCanvasElement)=="function"?mn:Object)],ft.prototype,"canvas",void 0);ft=xt([y("rr-scope-background"),St("design:paramtypes",[])],ft);var Ie;(function(r){r[r.Ascending=0]="Ascending",r[r.Descending=1]="Descending"})(Ie||(Ie={}));var Be;(function(r){r[r.Horizontal=0]="Horizontal",r[r.Vertical=1]="Vertical"})(Be||(Be={}));function gn(r,t,e,i,s,n,o,a=[1,2,5,10]){let l=t-r,c=Math.pow(10,Math.floor(Math.log10(l/2))),u=ds(e/s,i/s,l,c,a),d=o==Be.Horizontal,m=[],f=r;for(f%u!=0&&(f+=u-f%u);f<=t;){let x=n==Ie.Ascending?(f-r)/l:(t-f)/l;m.push({position:x,value:f,horizontal:d}),f+=u}return m}function ds(r,t,e,i,s){let n=e*r/i,o=e*t/i,a=(n+o)/2;if(o<s[0])return ds(r,t,e,i/10,s);if(n>s[s.length-1])return ds(r,t,e,i*10,s);let l=s[0],c=Math.abs(l-a),u=l>=n&&l<=o;for(let d=1;d<s.length;++d){let m=s[d]>=n&&s[d]<=o;if(u&&!m)continue;let f=Math.abs(s[d]-a);f<c&&(l=s[d],c=f,u=m)}return l*i}var _t=function(r,t,e,i){var s=arguments.length,n=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(t,e,n):o(t,e))||n);return s>3&&n&&Object.defineProperty(t,e,n),n},Pt=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},bn,wn,j=class extends w{constructor(){super(...arguments),this.centerFrequency=0,this.frequencyScale=1,this.minDecibels=-100,this.maxDecibels=-30,this.fftSize=2048,this.zoom=U}static get styles(){return[b`
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
    </div> `}addFloatSpectrum(t){t.length!=this.fftSize&&(this.fftSize=t.length),this.line?.addFloatSpectrum(t)}};_t([h({type:Number,reflect:!0}),Pt("design:type",Number)],j.prototype,"bandwidth",void 0);_t([h({type:Number,reflect:!0,attribute:"center-frequency"}),Pt("design:type",Number)],j.prototype,"centerFrequency",void 0);_t([h({type:Number,reflect:!0,attribute:"frequency-scale"}),Pt("design:type",Number)],j.prototype,"frequencyScale",void 0);_t([h({type:Number,reflect:!0,attribute:"min-decibels"}),Pt("design:type",Number)],j.prototype,"minDecibels",void 0);_t([h({type:Number,reflect:!0,attribute:"max-decibels"}),Pt("design:type",Number)],j.prototype,"maxDecibels",void 0);_t([h({type:Number,reflect:!0}),Pt("design:type",Number)],j.prototype,"fftSize",void 0);_t([h({attribute:!1}),Pt("design:type",typeof(bn=typeof S<"u"&&S)=="function"?bn:Object)],j.prototype,"zoom",void 0);_t([v("#line"),Pt("design:type",typeof(wn=typeof pt<"u"&&pt)=="function"?wn:Object)],j.prototype,"line",void 0);j=_t([y("rr-scope")],j);function Lo(r,t,e,i){let s=new Array(256),n=s.length;for(let o=0;o<n;++o){let a=o/(n-1),l=Math.pow(a,i),c=2*Math.PI*(r/3+t*a),u=e*l*(1-l)/2,d=Math.cos(c),m=Math.sin(c),f=l+u*(-.14861*d+1.78277*m),x=l+u*(-.29227*d-.90649*m),D=l+u*1.97294*d;s[o]=[Math.floor(Math.max(0,Math.min(255,256*f))),Math.floor(Math.max(0,Math.min(255,256*x))),Math.floor(Math.max(0,Math.min(255,256*D)))]}return s}var ne=Lo(2,1,3,1);function Uo(){let r=[.13572138,4.6153926,-42.66032258,132.13108234,-152.94239396,59.28637943],t=[.09140261,2.19418839,4.84296658,-14.18503333,4.27729857,2.82956604],e=[.1066733,12.64194608,-60.58204836,110.36276771,-89.90310912,27.34824973],i=(o,a)=>o[0]*a[0]+o[1]*a[1]+o[2]*a[2]+o[3]*a[3]+o[4]*a[4]+o[5]*a[5],s=new Array(256),n=s.length;for(let o=0;o<n;++o){let a=o/255,l=[1,a,a*a,a*a*a,a*a*a*a,a*a*a*a*a];s[o]=[Math.floor(Math.max(0,Math.min(255,255*i(l,r)))),Math.floor(Math.max(0,Math.min(255,255*i(l,t)))),Math.floor(Math.max(0,Math.min(255,255*i(l,e))))]}return s}var fc=Uo();var z=class{constructor(t,e=4){this.handler=t;this.minPixelDelta=e;this.onPointerMove=i=>this.drag(i),this.onPointerUp=i=>this.finish(i),this.onPointerCancel=i=>this.cancel(i)}startDragging(t){t.button==0&&(this.dragData&&(this.handler.cancelDrag(),this.dragData.release()),this.dragData=new us(t,this.minPixelDelta,this.onPointerMove,this.onPointerUp,this.onPointerCancel),this.dragData.capture(),this.drag(t),t.preventDefault())}drag(t){if(this.dragData===void 0)return;t.preventDefault();let{start:e,moved:i,x:s,y:n}=this.dragData.delta(t);i&&(e&&this.handler.startDrag(),this.handler.drag(s,n))}finish(t){this.dragData!==void 0&&(this.dragData.hasMoved()?(this.handler.finishDrag(),t.preventDefault()):this.handler.onClick(t),this.release())}cancel(t){this.dragData!==void 0&&(this.handler.cancelDrag(),t.preventDefault(),this.release())}release(){this.dragData?.release(),this.dragData=void 0}},us=class{constructor(t,e,i,s,n){this.minPixelDelta=e;this.move=i;this.up=s;this.cancel=n;this.moved=!1,this.startX=t.clientX,this.startY=t.clientY,this.pointerId=t.pointerId,this.target=t.target}capture(){this.target.addEventListener("pointermove",this.move),this.target.addEventListener("pointerup",this.up),this.target.addEventListener("pointercancel",this.cancel),this.target.setPointerCapture(this.pointerId)}release(){this.target.removeEventListener("pointermove",this.move),this.target.removeEventListener("pointerup",this.up),this.target.removeEventListener("pointercancel",this.cancel),this.target.releasePointerCapture(this.pointerId)}hasMoved(){return this.moved}delta(t){let e=!1;!this.moved&&this.minPixelDelta==0&&(e=!0,this.moved=!0);let i={start:e,moved:this.moved,x:t.clientX-this.startX,y:t.clientY-this.startY};return i.moved||Math.max(Math.abs(i.x),Math.abs(i.y))>=this.minPixelDelta&&(this.moved=!0,i.moved=!0,i.start=!0),i}};var Mi=class{constructor(){this.palette=ne;this.images=[]}addFloatSpectrum(t,e,i,s,n){let o=t.length;if(this.prepareImageStack(o),s!==void 0&&n!==void 0){if(s!==this.frequency&&this.frequency!==void 0){let c=(s-this.frequency)/n;this.images.map(u=>u.scroll(c))}this.frequency=s}let a=this.images.map(c=>c.startRow(o,e,i)),l=o/2;for(let c=0;c<o;++c)a.map(u=>u.addBin(t[(c+l)%o]))}draw(t,e){let i=e.level*t.canvas.offsetWidth;(this.images.find(n=>n.width>=i)||this.images[this.images.length-1])?.draw(t,e)}prepareImageStack(t){let e=this.images[this.images.length-1];if((e?.width||0)==t)return;let s=[1024,2048,8192,32768].filter(a=>a<t);s.push(t);let n=0,o=0;for(;n<s.length||o<this.images.length;){let a=s[n],l=this.images[o]?.width;if(a===void 0||a>l){this.images.splice(o,1);continue}(l===void 0||a<l)&&this.images.splice(o,0,e?.resizeTo(a)||new ps(a,this.palette)),++n,++o}}},ps=class r{constructor(t,e){this.width=t;this.palette=e;this.scrollError=0;this.height=screen.height,this.data=new Uint8ClampedArray(4*this.width*(this.height+1)),this.xOffset=0,this.yOffset=0}startRow(t,e,i){return this.deltaY(-1),new fs(this.data,(this.xOffset+this.yOffset*this.width)*4,t/this.width,e,i,this.palette)}draw(t,e){let i=new Y(e,this.width,this.width);t.canvas.width!=i.visibleBins&&(t.canvas.width=i.visibleBins),t.canvas.height!=t.canvas.offsetHeight&&(t.canvas.height=t.canvas.offsetHeight);let s=Math.min(this.height-this.yOffset,t.canvas.height),n=(this.xOffset+this.yOffset*this.width)*4,o=n+s*this.width*4;t.putImageData(new ImageData(this.data.subarray(n,o),this.width),-i.leftBin,0);let a=t.canvas.height-s;if(a<=0)return;let l=(this.xOffset+a*this.width)*4;t.putImageData(new ImageData(this.data.subarray(this.xOffset*4,l),this.width),-i.leftBin,s)}scroll(t){if(t>=1||t<=-1){this.data.fill(0),this.xOffset=0,this.yOffset=0,this.scrollError=0;return}t+=this.scrollError;let e=Math.round(this.width*t);if(this.scrollError=t-e/this.width,e==0)return;this.deltaX(e);let i=e>0?-e:0,s=e>0?0:-e;for(let n=0;n<=this.height;++n){let o=n*this.width+this.xOffset;this.data.fill(0,(o+i)*4,(o+s)*4)}}resizeTo(t){let e=new OffscreenCanvas(this.width,this.height);e.getContext("2d").putImageData(new ImageData(this.data.subarray(this.xOffset*4,(this.xOffset+this.height*this.width)*4),this.width),0,0);let n=new OffscreenCanvas(t,this.height).getContext("2d");n.drawImage(e,0,0,t,this.height);let o=new r(t,this.palette);return o.data.set(n.getImageData(0,0,t,this.height).data),o.xOffset=0,o.yOffset=this.yOffset,o.scrollError=this.scrollError,o}deltaX(t){let e=this.xOffset+t,i=0;if(e<0){let s=this.height*this.width*4;for(this.data.copyWithin(s+this.xOffset*4,this.xOffset*4,this.width*4);e<0;)e+=this.width,i--}if(e>=this.width){let s=this.height*this.width*4;for(this.data.copyWithin(0,s,s+this.xOffset*4);e>=this.width;)e-=this.width,i++}this.xOffset=e,i!=0&&this.deltaY(i)}deltaY(t){let e=this.yOffset+t;for(;e<0;)e+=this.height;for(;e>=this.height;)e-=this.height;this.yOffset=e}},fs=class{constructor(t,e,i,s,n,o){this.data=t;this.offset=e;this.ratio=i;this.palette=o;this.p=0;this.value=0;this.sub=s,this.mul=256/(n-s)}addBin(t){if((this.p==0||t>this.value)&&(this.value=t),this.p++,this.p<this.ratio)return;let e=Math.max(0,Math.min(255,Math.floor(this.mul*(this.value-this.sub)))),i=this.palette[isNaN(e)?0:e];this.data[this.offset++]=i[0],this.data[this.offset++]=i[1],this.data[this.offset++]=i[2],this.data[this.offset++]=255,this.p=0}};var Rt=function(r,t,e,i){var s=arguments.length,n=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(t,e,n):o(t,e))||n);return s>3&&n&&Object.defineProperty(t,e,n),n},Dt=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},yn,vn,W=class extends w{static get styles(){return[b`
        #waterfall {
          width: 100%;
          height: 100%;
        }
      `]}render(){return p`<canvas id="waterfall"></canvas>`}constructor(){super(),this.minDecibels=-100,this.maxDecibels=-30,this.palette=ne,this.fftSize=2048,this.zoom=U,this.draggable=!1,this.image=new Mi,this.addEventListener("pointerdown",t=>this.onPointerDown(t))}firstUpdated(t){super.firstUpdated(t),this.dragController=new z(new ms(this))}updated(t){super.updated(t),t.has("zoom")&&this.redraw()}addFloatSpectrum(t,e){this.image.addFloatSpectrum(e,this.minDecibels,this.maxDecibels,t,this.bandwidth),this.redraw()}redraw(){let t=this.getContext();t&&this.image.draw(t,this.zoom)}getContext(){return this.context?this.context:this.canvas?(this.context=this.canvas.getContext("2d"),new ResizeObserver(()=>this.redraw()).observe(this.canvas),this.context):void 0}onPointerDown(t){this.draggable&&this.dragController?.startDragging(t)}};Rt([h({type:Number,reflect:!0,attribute:"min-decibels"}),Dt("design:type",Number)],W.prototype,"minDecibels",void 0);Rt([h({type:Number,reflect:!0,attribute:"max-decibels"}),Dt("design:type",Number)],W.prototype,"maxDecibels",void 0);Rt([h({attribute:!1}),Dt("design:type",Object)],W.prototype,"palette",void 0);Rt([h({type:Number,reflect:!0}),Dt("design:type",Number)],W.prototype,"fftSize",void 0);Rt([h({attribute:!1}),Dt("design:type",typeof(yn=typeof S<"u"&&S)=="function"?yn:Object)],W.prototype,"zoom",void 0);Rt([h({type:Number,reflect:!0}),Dt("design:type",Number)],W.prototype,"bandwidth",void 0);Rt([h({type:Boolean,reflect:!0}),Dt("design:type",Boolean)],W.prototype,"draggable",void 0);Rt([v("#waterfall"),Dt("design:type",typeof(vn=typeof HTMLCanvasElement<"u"&&HTMLCanvasElement)=="function"?vn:Object)],W.prototype,"canvas",void 0);W=Rt([y("rr-waterfall"),Dt("design:paramtypes",[])],W);var ms=class{constructor(t){this.waterfall=t,this.fraction=0}startDrag(){this.fraction=0,this.waterfall.dispatchEvent(new jt({fraction:0,target:"waterfall",operation:"start"}))}drag(t,e){this.fraction=t/(this.waterfall.clientWidth*this.waterfall.zoom.level),this.waterfall.dispatchEvent(new jt({fraction:this.fraction,target:"waterfall"}))}finishDrag(){this.waterfall.dispatchEvent(new jt({fraction:this.fraction,target:"waterfall",operation:"finish"}))}cancelDrag(){this.waterfall.dispatchEvent(new jt({fraction:0,target:"waterfall",operation:"cancel"}))}onClick(t){let i=new Y(this.waterfall.zoom,this.waterfall.offsetWidth,this.waterfall.fftSize).unzoomed(t.offsetX/this.waterfall.offsetWidth);this.waterfall.dispatchEvent(new ie({fraction:i,target:"waterfall"})),t.preventDefault()}};var $t=function(r,t,e,i){var s=arguments.length,n=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(t,e,n):o(t,e))||n);return s>3&&n&&Object.defineProperty(t,e,n),n},Tt=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},xn,Sn,_n,Rn,Dn,mt=class extends w{constructor(){super(...arguments),this.minDecibels=-100,this.maxDecibels=-30,this.palette=ne}static get styles(){return[b`
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
        .value=${oe(this.minDecibels)}
        @focus=${this.onMinFocus}
        @blur=${this.onMinBlur}
        @change=${this.onMinChange}
      />
      <canvas id="palette" width="256" height="24"></canvas>
      <input
        id="max"
        type="text"
        .value=${oe(this.maxDecibels)}
        @focus=${this.onMaxFocus}
        @blur=${this.onMaxBlur}
        @change=${this.onMaxChange}
      />
      <div id="minThumb" @pointerdown=${this.onMinPointerDown}>
        <div class="touchArea"></div>
      </div>
      <div id="maxThumb" @pointerdown=${this.onMaxPointerDown}>
        <div class="touchArea"></div>
      </div>`}firstUpdated(t){super.firstUpdated(t),this.minDragController=new z(new Ei("min",this,this.paletteBox),0),this.maxDragController=new z(new Ei("max",this,this.paletteBox),0),new ResizeObserver(()=>this.repaintPalette()).observe(document.body),this.repaintPalette()}updated(t){super.updated(t),this.repaintPalette()}repaintPalette(){let t=this.getContext();if(t){for(let e=0;e<t.canvas.width;++e){let s=255*(e*150/255+-150-this.minDecibels)/(this.maxDecibels-this.minDecibels);s<0&&(s=0),s>255&&(s=255),s=Math.floor(s),t.fillStyle=gs(this.palette[s]),t.fillRect(e,0,1,24)}this.minBox&&(this.minBox.style.backgroundColor=gs(this.palette[0]),this.minBox.style.color=$n(this.palette[0])?"white":"black"),this.maxBox&&(this.maxBox.style.backgroundColor=gs(this.palette[255]),this.maxBox.style.color=$n(this.palette[255])?"white":"black"),this.minThumb&&this.paletteBox&&(this.minThumb.style.right=(this.minDecibels-0)*this.paletteBox.offsetWidth/-150+this.paletteBox.offsetLeft+"px"),this.maxThumb&&this.paletteBox&&(this.maxThumb.style.left=(this.maxDecibels- -150)*this.paletteBox.offsetWidth/150+this.paletteBox.offsetLeft+"px")}}getContext(){if(this.context)return this.context;if(this.paletteBox)return this.context=this.paletteBox.getContext("2d"),this.context}onMinFocus(t){let e=t.target;e.value=bs(this.minDecibels)}onMinBlur(t){let e=t.target;e.value=oe(this.minDecibels)}onMinChange(t){let e=t.target,i=e.value;i.endsWith("dB")&&(i=i.substring(0,i.length-2).trim());let s=Number(i);isNaN(s)?e.value=oe(this.minDecibels):Mn(s,this)}onMaxFocus(t){let e=t.target;e.value=bs(this.maxDecibels)}onMaxBlur(t){let e=t.target;e.value=oe(this.maxDecibels)}onMaxChange(t){let e=t.target,i=e.value;i.endsWith("dB")&&(i=i.substring(0,i.length-2).trim());let s=Number(i);isNaN(s)?e.value=oe(this.maxDecibels):En(s,this)}onMinPointerDown(t){this.minDragController?.startDragging(t)}onMaxPointerDown(t){this.maxDragController?.startDragging(t)}};$t([h({type:Number,reflect:!0,attribute:"min-decibels"}),Tt("design:type",Number)],mt.prototype,"minDecibels",void 0);$t([h({type:Number,reflect:!0,attribute:"max-decibels"}),Tt("design:type",Number)],mt.prototype,"maxDecibels",void 0);$t([h({attribute:!1}),Tt("design:type",Object)],mt.prototype,"palette",void 0);$t([v("#min"),Tt("design:type",typeof(xn=typeof HTMLElement<"u"&&HTMLElement)=="function"?xn:Object)],mt.prototype,"minBox",void 0);$t([v("#max"),Tt("design:type",typeof(Sn=typeof HTMLElement<"u"&&HTMLElement)=="function"?Sn:Object)],mt.prototype,"maxBox",void 0);$t([v("#palette"),Tt("design:type",typeof(_n=typeof HTMLCanvasElement<"u"&&HTMLCanvasElement)=="function"?_n:Object)],mt.prototype,"paletteBox",void 0);$t([v("#minThumb"),Tt("design:type",typeof(Rn=typeof HTMLElement<"u"&&HTMLElement)=="function"?Rn:Object)],mt.prototype,"minThumb",void 0);$t([v("#maxThumb"),Tt("design:type",typeof(Dn=typeof HTMLElement<"u"&&HTMLElement)=="function"?Dn:Object)],mt.prototype,"maxThumb",void 0);mt=$t([y("rr-decibel-range")],mt);function gs(r){return`rgb(${r[0]}, ${r[1]}, ${r[2]})`}function $n(r){return Math.max(r[0],r[1],r[2])<96}var Ei=class{constructor(t,e,i){this.type=t,this.range=e,this.box=i,this.startDb=0}startDrag(){this.startDb=this.type==="min"?this.range.minDecibels:this.range.maxDecibels}drag(t,e){let i=t/this.box.offsetWidth;this.changeDb(this.startDb+i*150)}finishDrag(){}cancelDrag(){this.changeDb(this.startDb)}onClick(){}changeDb(t){this.type=="min"?Mn(t,this.range):En(t,this.range)}};function Mn(r,t){r=Math.round(r),r<-150&&(r=-150),r>0&&(r=0),r>t.maxDecibels-6&&(r=t.maxDecibels-6),t.minDecibels=r,t.dispatchEvent(new ke({min:r}))}function En(r,t){r=Math.round(r),r<-150&&(r=-150),r>0&&(r=0),r<t.minDecibels+6&&(r=t.minDecibels+6),t.maxDecibels=r,t.dispatchEvent(new ke({max:r}))}function oe(r){return bs(r)+" dB"}function bs(r){return String(r)}var Vt=function(r,t,e,i){var s=arguments.length,n=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(t,e,n):o(t,e))||n);return s>3&&n&&Object.defineProperty(t,e,n),n},ae=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},An,kt=class extends w{constructor(){super(...arguments),this.draggablePoint=!1,this.draggableLeft=!1,this.draggableRight=!1,this.fftSize=2048,this.zoom=U}static get styles(){return[b`
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
      `]}render(){return p`${this.renderBand()}${this.renderPoint()}`}renderPoint(){if(this.selection?.point===void 0)return g;let e=new Y(this.zoom,this.offsetWidth,this.fftSize).zoomed(this.selection.point);return e<0||e>1?g:p`<div id="point" style="left:calc(${100*e}% - 1px)"></div>
      ${this.draggablePoint?p`<div
            id="pointHandle"
            class="handle"
            style="left:calc(${100*e}% - 2px)"
            @pointerdown=${this.onPointPointerDown}
          >
            <div class="touchArea"></div>
          </div>`:g}`}renderBand(){if(this.selection?.band===void 0)return g;let t=new Y(this.zoom,this.offsetWidth,this.fftSize),e=t.zoomed(this.selection.band.left),i=t.zoomed(this.selection.band.right);if(e>1||i<0)return g;let s=Math.max(0,e),n=Math.min(i,1);return p`<div
        id="band"
        style="left:${100*s}%;width:${100*(n-s)}%"
      ></div>
      ${this.draggableLeft&&e==s?p`<div
            id="leftBandHandle"
            class="handle"
            style="left:calc(${100*e}% - 2px)"
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
          </div>`:g}`}firstUpdated(t){super.firstUpdated(t),this.pointDragController=new z(new qe("point",this),0),this.leftDragController=new z(new qe("start",this),0),this.rightDragController=new z(new qe("end",this),0)}onPointPointerDown(t){this.pointDragController?.startDragging(t)}onLeftPointerDown(t){this.leftDragController?.startDragging(t)}onRightPointerDown(t){this.rightDragController?.startDragging(t)}};Vt([h({type:Boolean,reflect:!0,attribute:"draggable-point"}),ae("design:type",Boolean)],kt.prototype,"draggablePoint",void 0);Vt([h({type:Boolean,reflect:!0,attribute:"draggable-left"}),ae("design:type",Boolean)],kt.prototype,"draggableLeft",void 0);Vt([h({type:Boolean,reflect:!0,attribute:"draggable-right"}),ae("design:type",Boolean)],kt.prototype,"draggableRight",void 0);Vt([h({type:Number,reflect:!0}),ae("design:type",Number)],kt.prototype,"fftSize",void 0);Vt([h({attribute:!1}),ae("design:type",typeof(An=typeof S<"u"&&S)=="function"?An:Object)],kt.prototype,"zoom",void 0);Vt([h({attribute:!1}),ae("design:type",Object)],kt.prototype,"selection",void 0);kt=Vt([y("rr-highlight")],kt);var qe=class{constructor(t,e){this.type=t,this.highlight=e}startDrag(){this.original=this.highlight.selection}drag(t,e){let i=this.highlight.zoom===void 0?1:this.highlight.zoom.level,s=this.getFraction();s!==void 0&&(s+=t/(this.highlight.offsetWidth*i),s<0&&(s=0),s>1&&(s=1),this.highlight.dispatchEvent(this.getEvent(s)))}finishDrag(){}cancelDrag(){let t=this.getFraction();t!==void 0&&this.highlight.dispatchEvent(this.getEvent(t))}onClick(){}getFraction(){return this.type=="point"?this.original?.point:this.type=="start"?this.original?.band?.left:this.original?.band?.right}getEvent(t){return new $i(this.type=="point"?{fraction:t}:this.type=="start"?{startFraction:t}:{endFraction:t})}};var nt=b`
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
`;var ys=function(r,t,e,i){var s=arguments.length,n=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(t,e,n):o(t,e))||n);return s>3&&n&&Object.defineProperty(t,e,n),n},Pn=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},Fn,Cn,Ai=class extends w{constructor(){super(...arguments),this.zoom=U}static get styles(){return[nt,b`
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
        ${yi}
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
      <button @click=${this.onClickButtonRight}>${vi}</button>`}firstUpdated(t){super.firstUpdated(t),this.dragController=new z(new ws(this,this.scrollBox),0)}onClickButtonLeft(){this.moveZoom(-1/20)}onClickButtonRight(){this.moveZoom(1/20)}onClickAreaLeft(){this.moveZoom(-.6)}onClickAreaRight(){this.moveZoom(.6)}moveZoom(t){let e=this.zoom.withMovedCenter(t/this.zoom.level);this.zoom=e,this.dispatchEvent(new Wt(e))}onPointerDown(t){this.dragController?.startDragging(t)}};ys([h({attribute:!1}),Pn("design:type",typeof(Fn=typeof S<"u"&&S)=="function"?Fn:Object)],Ai.prototype,"zoom",void 0);ys([v("#scroll"),Pn("design:type",typeof(Cn=typeof HTMLElement<"u"&&HTMLElement)=="function"?Cn:Object)],Ai.prototype,"scrollBox",void 0);Ai=ys([y("rr-scrollbar")],Ai);var ws=class{constructor(t,e){this.scrollbar=t,this.box=e,this.startZoom=U}startDrag(){this.startZoom=this.scrollbar.zoom}drag(t,e){let i=t/this.box.offsetWidth;this.moveZoom(i)}finishDrag(){}cancelDrag(){this.moveZoom(0)}onClick(){}moveZoom(t){let e=this.startZoom.withMovedCenter(t);this.scrollbar.zoom=e,this.scrollbar.dispatchEvent(new Wt(this.scrollbar.zoom))}};var xs=function(r,t,e,i){var s=arguments.length,n=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(t,e,n):o(t,e))||n);return s>3&&n&&Object.defineProperty(t,e,n),n},kn=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},Tn,Fi=class extends w{constructor(){super(...arguments),this.zoom=U}static get styles(){return[nt,b`
        :host {
          display: flex;
          flex-direction: row;
        }

        #zoomInput {
          width: 6ex;
        }
      `]}render(){return p`<button @click=${this.onClickMinus}>${Si}</button>
      <input
        id="zoomInput"
        type="text"
        .value=${vs(this.zoom.level)}
        @focus=${this.onZoomFocus}
        @blur=${this.onZoomBlur}
        @change=${this.onZoomChange}
      />
      <button @click=${this.onClickPlus}>${xi}</button>`}onZoomFocus(t){let e=t.target;e.value=In(this.zoom.level)}onZoomBlur(t){let e=t.target;e.value=vs(this.zoom.level)}onZoomChange(t){let e=t.target,i=e.value;i.endsWith("x")&&(i=i.substring(0,i.length-1));let s=Number(i);isNaN(s)?e.value=vs(this.zoom.level):this.setZoom(s)}onClickMinus(){this.setZoom(this.zoom.level/Math.sqrt(2))}onClickPlus(){this.setZoom(this.zoom.level*Math.sqrt(2))}setZoom(t){Math.abs(t-Math.round(t))<.01&&(t=Math.round(t));let e=this.zoom;this.highlight?.point!==void 0?e=e.withLevelInContext(t,this.highlight.point):e=e.withLevel(t),this.zoom=e,this.dispatchEvent(new Wt(e))}};xs([h({attribute:!1}),kn("design:type",typeof(Tn=typeof S<"u"&&S)=="function"?Tn:Object)],Fi.prototype,"zoom",void 0);xs([h({attribute:!1}),kn("design:type",Object)],Fi.prototype,"highlight",void 0);Fi=xs([y("rr-zoombar")],Fi);function vs(r){return In(r)+"x"}function In(r){return String(Math.round(r*100)/100)}var Z=function(r,t,e,i){var s=arguments.length,n=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(t,e,n):o(t,e))||n);return s>3&&n&&Object.defineProperty(t,e,n),n},J=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},Bn,qn,Nn,C=class extends w{constructor(){super(...arguments),this.centerFrequency=0,this.frequencyScale=1,this.minDecibels=-100,this.maxDecibels=-30,this.fftSize=2048,this.zoom=U,this.highlightDraggablePoint=!1,this.highlightDraggableLeft=!1,this.highlightDraggableRight=!1,this.waterfallDraggable=!1}static get styles(){return[b`
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
      </div>`}addFloatSpectrum(t,e){this.fftSize!=e.length&&(this.fftSize=e.length),this.scope?.addFloatSpectrum(e),this.waterfall?.addFloatSpectrum(t,e)}onZoom(t){this.zoom=t.detail}onDecibelRangeChanged(t){t.detail.min!==void 0&&(this.minDecibels=t.detail.min),t.detail.max!==void 0&&(this.maxDecibels=t.detail.max)}};Z([h({type:Number,reflect:!0}),J("design:type",Number)],C.prototype,"bandwidth",void 0);Z([h({type:Number,reflect:!0,attribute:"center-frequency"}),J("design:type",Number)],C.prototype,"centerFrequency",void 0);Z([h({type:Number,reflect:!0,attribute:"frequency-scale"}),J("design:type",Number)],C.prototype,"frequencyScale",void 0);Z([h({type:Number,reflect:!0,attribute:"min-decibels"}),J("design:type",Number)],C.prototype,"minDecibels",void 0);Z([h({type:Number,reflect:!0,attribute:"max-decibels"}),J("design:type",Number)],C.prototype,"maxDecibels",void 0);Z([h({type:Number,reflect:!0}),J("design:type",Number)],C.prototype,"fftSize",void 0);Z([h({attribute:!1}),J("design:type",typeof(Bn=typeof S<"u"&&S)=="function"?Bn:Object)],C.prototype,"zoom",void 0);Z([h({attribute:!1}),J("design:type",Object)],C.prototype,"highlight",void 0);Z([h({attribute:!1}),J("design:type",Boolean)],C.prototype,"highlightDraggablePoint",void 0);Z([h({attribute:!1}),J("design:type",Boolean)],C.prototype,"highlightDraggableLeft",void 0);Z([h({attribute:!1}),J("design:type",Boolean)],C.prototype,"highlightDraggableRight",void 0);Z([h({attribute:!1}),J("design:type",Boolean)],C.prototype,"waterfallDraggable",void 0);Z([v("#scope"),J("design:type",typeof(qn=typeof j<"u"&&j)=="function"?qn:Object)],C.prototype,"scope",void 0);Z([v("#waterfall"),J("design:type",typeof(Nn=typeof W<"u"&&W)=="function"?Nn:Object)],C.prototype,"waterfall",void 0);C=Z([y("rr-spectrum")],C);var tt=function(r,t,e,i){var s=arguments.length,n=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(t,e,n):o(t,e))||n);return s>3&&n&&Object.defineProperty(t,e,n),n},O=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},zn,P=class extends w{constructor(){super(...arguments),this.label="",this.resizeable=!1,this.closeable=!1,this.fixed=!1,this.closed=!1,this.modal=!1,this.moving=!1}set position(t){this.pendingPosition=t}get position(){return this.pendingPosition||this.getPosition()}set size(t){this.pendingSize=t}get size(){return this.pendingSize||this.getSize()}static get styles(){return[nt,b`
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
                ${en}
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
                ${sn}
              </div>`:g}
      </div>`}connectedCallback(){super.connectedCallback(),this.addEventListener("click",t=>this.onSelect(t)),Ne?.register(this)}disconnectedCallback(){super.disconnectedCallback(),Ne?.unregister(this)}firstUpdated(t){super.firstUpdated(t),this.doUpdates(t)}updated(t){super.updated(t),this.doUpdates(t)}doUpdates(t){t.has("closed")&&(Ne?.show(!this.closed,this),this.closed||(this.modal||(this.moveController=new z(new Ss(this),0)),this.rightResizeController=new z(new ze(this,this.content,!0,!1),0),this.bottomResizeController=new z(new ze(this,this.content,!1,!0),0),this.cornerResizeController=new z(new ze(this,this.content,!0,!0),0),this.dispatchEvent(new Ds))),this.closed||(this.modal&&(this.pendingSize=void 0,this.pendingPosition=void 0,this.setCenterPosition(),setTimeout(()=>Ne?.select(this),0)),this.pendingSize&&(this.setSize(this.pendingSize),this.pendingSize=void 0),this.pendingPosition&&(this.setPosition(this.pendingPosition),this.pendingPosition=void 0))}getPosition(){if(!(this.closed||this.offsetWidth==0&&this.offsetHeight==0)&&getComputedStyle(this).position=="absolute")return{top:this.offsetTop,left:this.offsetLeft,bottom:visualViewport.height-this.offsetTop-this.offsetHeight,right:visualViewport.width-this.offsetLeft-this.offsetWidth}}getSize(){if(!(!this.resizeable||!this.content||this.closed||this.offsetWidth==0&&this.offsetWidth==0)&&getComputedStyle(this).position=="absolute")return{width:this.offsetWidth,height:this.content.offsetHeight}}setCenterPosition(){let t=this.offsetWidth,e=this.offsetHeight;this.style.left=`calc(50vw - ${t/2}px)`,this.style.top=`calc(50vh - ${e/2}px)`,this.style.right="auto",this.style.bottom="auto"}setPosition(t){let e=visualViewport.width,i=visualViewport.height,s=t.left+this.offsetWidth<=e,n=t.right+this.offsetWidth<=e,o=t.top+this.offsetHeight<=i,a=t.bottom+this.offsetHeight<=i,l=t.left<=t.right,c=t.top<=t.bottom;l&&s?(this.style.left=`${t.left}px`,this.style.right="auto"):!l&&n?(this.style.right=`${t.right}px`,this.style.left="auto"):(this.style.left=`${Math.max(0,Math.floor((e-this.offsetWidth)/2))}px`,this.style.right="auto"),c&&o?(this.style.top=`${t.top}px`,this.style.bottom="auto"):!c&&a?(this.style.bottom=`${t.bottom}px`,this.style.top="auto"):(this.style.top=`${Math.max(0,Math.floor((i-this.offsetHeight)/2))}px`,this.style.bottom="auto")}setSize(t){if(this.content===void 0)return;let e=visualViewport.width,i=visualViewport.height,s=this.offsetTop+this.content.offsetTop,n=this.offsetLeft+this.content.offsetLeft;t.width>=e&&(t.width=Math.floor(e)),t.height+this.content.offsetTop>=i&&(t.height=Math.floor(i-this.content.offsetTop));let o=n+this.content.offsetWidth<=e,a=s+this.content.offsetHeight<=i;if(!o){let l=Math.floor(e-t.width-this.content.offsetLeft);this.style.left=`${l}px`,this.style.right="auto"}if(!a){let l=Math.floor(i-t.height-this.content.offsetTop);this.style.top=`${l}px`,this.style.bottom="auto"}$s(this,this.content,t.width,t.height)}onClosePressed(){this.closed=!0,this.dispatchEvent(new Rs)}onSelect(t){Ne?.select(this)&&t.stopPropagation()}noPointerDown(t){t.stopPropagation()}onLabelPointerDown(t){this.fixed||this.moveController?.startDragging(t)}onRightResizerPointerDown(t){this.fixed||this.rightResizeController?.startDragging(t)}onBottomResizerPointerDown(t){this.fixed||this.bottomResizeController?.startDragging(t)}onCornerResizerPointerDown(t){this.fixed||this.cornerResizeController?.startDragging(t)}};tt([h({type:String,reflect:!0}),O("design:type",String)],P.prototype,"label",void 0);tt([h({type:Boolean,reflect:!0}),O("design:type",Boolean)],P.prototype,"resizeable",void 0);tt([h({type:Boolean,reflect:!0}),O("design:type",Boolean)],P.prototype,"closeable",void 0);tt([h({type:Boolean,reflect:!0}),O("design:type",Boolean)],P.prototype,"fixed",void 0);tt([h({type:Boolean,reflect:!0}),O("design:type",Boolean)],P.prototype,"closed",void 0);tt([h({type:Boolean,reflect:!0}),O("design:type",Boolean)],P.prototype,"modal",void 0);tt([h({attribute:!1}),O("design:type",Object),O("design:paramtypes",[Object])],P.prototype,"position",null);tt([h({attribute:!1}),O("design:type",Object),O("design:paramtypes",[Object])],P.prototype,"size",null);tt([K(),O("design:type",Boolean)],P.prototype,"moving",void 0);tt([v(".content"),O("design:type",typeof(zn=typeof HTMLDivElement<"u"&&HTMLDivElement)=="function"?zn:Object)],P.prototype,"content",void 0);P=tt([y("rr-window")],P);function le(r){class t extends r{set closed(i){this.pendingClosed=i}get closed(){return this.pendingClosed!==void 0?this.pendingClosed:this.window?.closed||!1}set position(i){this.pendingPosition=i}get position(){return this.pendingPosition||this.window?.position}set size(i){this.pendingSize=i}get size(){return this.pendingSize||this.window?.size}firstUpdated(i){super.firstUpdated(i),this.doUpdate()}updated(i){super.updated(i),this.doUpdate()}doUpdate(){this.pendingClosed!==void 0&&this.window&&(this.window.closed=this.pendingClosed,this.pendingClosed=void 0),this.pendingSize!==void 0&&this.window&&(this.window.size=this.pendingSize,this.pendingSize=void 0),this.pendingPosition!==void 0&&this.window&&(this.window.position=this.pendingPosition,this.pendingPosition=void 0)}}return tt([h({type:Boolean,reflect:!0}),O("design:type",Boolean),O("design:paramtypes",[Boolean])],t.prototype,"closed",null),tt([h({attribute:!1}),O("design:type",Object),O("design:paramtypes",[Object])],t.prototype,"position",null),tt([h({attribute:!1}),O("design:type",Object),O("design:paramtypes",[Object])],t.prototype,"size",null),t}function On(r){let t=r.getBoundingClientRect(),e=t.left+window.scrollX,i=t.top+window.scrollY;r.style.left=`${e}px`,r.style.top=`${i}px`,r.style.right="auto",r.style.bottom="auto"}function Ho(r,t,e){let i=r.offsetLeft,s=r.offsetTop;t>visualViewport.width-r.offsetWidth&&(t=visualViewport.width-r.offsetWidth),e>visualViewport.height-r.offsetHeight&&(e=visualViewport.height-r.offsetHeight),t<0&&(t=0),e<0&&(e=0),(t!=i||e!=s)&&Ln(r,Math.floor(t),Math.floor(e))}function jo(r,t,e,i){let s=r.offsetLeft,n=r.offsetTop,o=t.offsetTop;s+e>visualViewport.width&&(e=visualViewport.width-s),n+o+i>visualViewport.height&&(i=visualViewport.height-n-o),i<32&&(i=32),(e!=t.offsetWidth||i!=t.offsetHeight)&&$s(r,t,Math.floor(e),Math.floor(i))}function Ln(r,t,e){r.style.left=t+"px",r.style.top=e+"px"}function $s(r,t,e,i){t.style.width=e+"px",t.style.height=i+"px",t.offsetWidth<r.offsetWidth&&(t.style.width=r.offsetWidth+"px")}var Ss=class{constructor(t){this.window=t,this.elemX=t.offsetLeft,this.elemY=t.offsetTop}startDrag(){On(this.window),this.window.moving=!0,this.elemX=this.window.offsetLeft,this.elemY=this.window.offsetTop}drag(t,e){Ho(this.window,this.elemX+t,this.elemY+e)}finishDrag(){this.window.moving=!1,this.window.dispatchEvent(new Ci)}cancelDrag(){this.window.moving=!1,Ln(this.window,this.elemX,this.elemY)}onClick(){}},ze=class{constructor(t,e,i,s){this.window=t,this.content=e,this.right=i,this.bottom=s,this.sizeX=e.offsetWidth,this.sizeY=e.offsetHeight}startDrag(){On(this.window),this.sizeX=this.content.offsetWidth,this.sizeY=this.content.offsetHeight}drag(t,e){jo(this.window,this.content,this.right?this.sizeX+t:this.sizeX,this.bottom?this.sizeY+e:this.sizeY)}finishDrag(){this.window.dispatchEvent(new Ci),this.window.dispatchEvent(new _s)}cancelDrag(){$s(this.window,this.content,this.sizeX,this.sizeY)}onClick(){}};var Ne;var Ci=class extends Event{constructor(){super("rr-window-moved",{bubbles:!0,composed:!0})}},_s=class extends Event{constructor(){super("rr-window-resized",{bubbles:!0,composed:!0})}},Rs=class extends Event{constructor(){super("rr-window-closed",{bubbles:!0,composed:!0})}},Ds=class extends Event{constructor(){super("rr-window-open",{bubbles:!0,composed:!0})}};var ce=function(r,t,e,i){var s=arguments.length,n=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(t,e,n):o(t,e))||n);return s>3&&n&&Object.defineProperty(t,e,n),n},he=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},Gt=class extends w{constructor(){super(...arguments),this.min=0,this.frequency=0,this._scale=1,this.step=1}get scale(){return this._scale}set scale(t){if(t!=1&&t!=1e3&&t!=1e6)return;let e=this._scale;this._scale=t,this.requestUpdate("scale",e)}static get styles(){return[b`
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
      </select>`}onFrequencyChange(t){let e=t.target,i=Number(e.value);if(!isNaN(i)){let s=i*this.scale;if(s>=this.min&&(this.max===void 0||s<=this.max)){this.frequency=i*this.scale,this.dispatchEvent(new Event("change"));return}}e.value=String(this.frequency/this.scale)}onScaleChange(t){let e=t.target,i=Number(e.selectedOptions[0].value);this.scale=i,this.dispatchEvent(new Event("scale-change"))}};ce([h({type:Number,reflect:!0}),he("design:type",Number)],Gt.prototype,"min",void 0);ce([h({type:Number,reflect:!0}),he("design:type",Number)],Gt.prototype,"max",void 0);ce([h({type:Number,reflect:!0}),he("design:type",Number)],Gt.prototype,"frequency",void 0);ce([h({type:Number,reflect:!0}),he("design:type",Number),he("design:paramtypes",[Number])],Gt.prototype,"scale",null);ce([h({type:Number,reflect:!0}),he("design:type",Number)],Gt.prototype,"step",void 0);Gt=ce([y("rr-frequency-input")],Gt);var R=function(r,t,e,i){var s=arguments.length,n=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(t,e,n):o(t,e))||n);return s>3&&n&&Object.defineProperty(t,e,n),n},$=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},Un,_=class extends le(w){constructor(){super(...arguments),this.inline=!1,this.showSettings=!0,this.showHelp=!0,this.needsReload=!1,this.playing=!1,this.scale=1e3,this.centerFrequency=885e5,this.tunedFrequency=885e5,this.tuningStep=1e3,this.availableSchemes=jr(),this.scheme="WBFM",this.bandwidth=15e4,this.stereo=!0,this.squelch=0,this.stereoStatus=!1,this.gain=null,this.gainDisabled=!1,this.maxFrequency=18e8,this.deviceLabel="No SDR",this.dspActive=!1,this.gpsLabel="GPS off",this.gpsState="",this.savedGain=0}static get styles(){return[nt,b`
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
            ${an}
          </button>`:this.playing?p`<button slot="label-left" id="stop" @click=${this.onStop}>
              ${gi}
            </button>`:p`<button slot="label-left" id="start" @click=${this.onStart}>
              ${bi}
            </button>`}
      <button slot="label-right" id="presets" @click=${this.onPresets}>
        ${Di}
      </button>
      ${this.showSettings?p`<button
            slot="label-right"
            id="settings"
            @click=${this.onSettings}
          >
            ${wi}
          </button>`:g}
      ${this.showHelp?p`<a slot="label-right" href="help.html" target="_blank"
            ><button id="help">${rn}</button></a
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
          ${this.availableSchemes.map(t=>p`<option value="${t}" .selected=${this.scheme==t}>
                ${t}
              </option>`)}
        </select>
        <div class="cfgBlock">
          <span .hidden=${!Q(this.scheme).hasBandwidth()}
            ><label for="bandwidth">Bandwidth: </label
            ><input
              type="number"
              id="bandwidth"
              min="0"
              max="20000"
              step="1"
              .value=${String(this.bandwidth)}
              @change=${this.onBandwidthChange} /></span
          ><span .hidden=${!Q(this.scheme).hasStereo()}>
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
              .hidden=${!Q(this.scheme).hasStereo()||!this.stereo}
              >${on}</span
            ></span
          ><span .hidden=${!Q(this.scheme).hasSquelch()}>
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
    </rr-window>`}onStart(){this.dispatchEvent(new Ms)}onStop(){this.dispatchEvent(new Es)}onReload(){location.reload()}onPresets(){this.dispatchEvent(new As)}onSettings(){this.dispatchEvent(new Fs)}onScaleChange(t){let e=t.target;this.scale=e.scale,this.dispatchEvent(new Cs)}onCenterFrequencyChange(t){let e=t.target;this.centerFrequency=e.frequency,this.dispatchEvent(new Ps)}onTunedFrequencyChange(t){let e=t.target;this.tunedFrequency=e.frequency,this.dispatchEvent(new Ts)}onTuningStepChange(t){let e=t.target,i=Number(e.value);if(isNaN(i)){e.value=String(this.tuningStep);return}this.tuningStep=i,this.dispatchEvent(new ks)}onModeChange(t){this.scheme=t.target.selectedOptions[0].value,this.dispatchEvent(new Is)}onBandwidthChange(t){let e=t.target,i=Number(e.value);if(isNaN(i)){e.value=String(this.bandwidth);return}this.bandwidth=i,this.dispatchEvent(new Bs)}onStereoChange(t){let e=t.target;this.stereo=e.checked,this.dispatchEvent(new qs)}onSquelchChange(t){let e=t.target,i=Number(e.value);(isNaN(i)||i<0)&&(i=0,e.value=String(i)),i>6&&(i=6,e.value=String(i)),this.squelch=i,this.dispatchEvent(new Ns)}onGainInput(t){let e=t.target,i=Number(e.value);if(isNaN(i)){e.value=this.gain==null?"":String(this.gain);return}this.gain=i,this.dispatchEvent(new Pi)}onGainAutoChange(t){t.target.checked?(this.gain!=null&&(this.savedGain=this.gain),this.gain=null):this.gain=this.savedGain,this.dispatchEvent(new Pi)}};R([h({attribute:!1}),$("design:type",Boolean)],_.prototype,"inline",void 0);R([h({attribute:!1}),$("design:type",Boolean)],_.prototype,"showSettings",void 0);R([h({attribute:!1}),$("design:type",Boolean)],_.prototype,"showHelp",void 0);R([h({attribute:!1}),$("design:type",Boolean)],_.prototype,"needsReload",void 0);R([h({attribute:!1}),$("design:type",Boolean)],_.prototype,"playing",void 0);R([h({attribute:!1}),$("design:type",Number)],_.prototype,"scale",void 0);R([h({attribute:!1}),$("design:type",Number)],_.prototype,"centerFrequency",void 0);R([h({attribute:!1}),$("design:type",Number)],_.prototype,"tunedFrequency",void 0);R([h({attribute:!1}),$("design:type",Number)],_.prototype,"tuningStep",void 0);R([h({attribute:!1}),$("design:type",Array)],_.prototype,"availableSchemes",void 0);R([h({attribute:!1}),$("design:type",String)],_.prototype,"scheme",void 0);R([h({attribute:!1}),$("design:type",Number)],_.prototype,"bandwidth",void 0);R([h({attribute:!1}),$("design:type",Boolean)],_.prototype,"stereo",void 0);R([h({attribute:!1}),$("design:type",Number)],_.prototype,"squelch",void 0);R([h({attribute:!1}),$("design:type",Boolean)],_.prototype,"stereoStatus",void 0);R([h({attribute:!1}),$("design:type",Object)],_.prototype,"gain",void 0);R([h({attribute:!1}),$("design:type",Boolean)],_.prototype,"gainDisabled",void 0);R([h({attribute:!1}),$("design:type",Number)],_.prototype,"maxFrequency",void 0);R([h({attribute:!1}),$("design:type",String)],_.prototype,"deviceLabel",void 0);R([h({attribute:!1}),$("design:type",Boolean)],_.prototype,"dspActive",void 0);R([h({attribute:!1}),$("design:type",String)],_.prototype,"gpsLabel",void 0);R([h({attribute:!1}),$("design:type",String)],_.prototype,"gpsState",void 0);R([K(),$("design:type",Number)],_.prototype,"savedGain",void 0);R([v("rr-window"),$("design:type",typeof(Un=typeof P<"u"&&P)=="function"?Un:Object)],_.prototype,"window",void 0);_=R([y("rr-main-controls")],_);var Ms=class extends Event{constructor(){super("rr-start",{bubbles:!0,composed:!0})}},Es=class extends Event{constructor(){super("rr-stop",{bubbles:!0,composed:!0})}},As=class extends Event{constructor(){super("rr-presets",{bubbles:!0,composed:!0})}},Fs=class extends Event{constructor(){super("rr-settings",{bubbles:!0,composed:!0})}},Cs=class extends Event{constructor(){super("rr-scale-changed",{bubbles:!0,composed:!0})}},Ps=class extends Event{constructor(){super("rr-center-frequency-changed",{bubbles:!0,composed:!0})}},Ts=class extends Event{constructor(){super("rr-tuned-frequency-changed",{bubbles:!0,composed:!0})}},ks=class extends Event{constructor(){super("rr-tuning-step-changed",{bubbles:!0,composed:!0})}},Is=class extends Event{constructor(){super("rr-scheme-changed",{bubbles:!0,composed:!0})}},Bs=class extends Event{constructor(){super("rr-bandwidth-changed",{bubbles:!0,composed:!0})}},qs=class extends Event{constructor(){super("rr-stereo-changed",{bubbles:!0,composed:!0})}},Ns=class extends Event{constructor(){super("rr-squelch-changed",{bubbles:!0,composed:!0})}},Pi=class extends Event{constructor(){super("rr-gain-changed",{bubbles:!0,composed:!0})}};var E=function(r,t,e,i){var s=arguments.length,n=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(t,e,n):o(t,e))||n);return s>3&&n&&Object.defineProperty(t,e,n),n},T=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},Hn,jn,M=class extends le(w){constructor(){super(...arguments),this.inline=!1,this.hidden=!1,this.tunedFrequency=885e5,this.scale=1e3,this.tuningStep=1e3,this.scheme="WBFM",this.bandwidth=15e4,this.stereo=!0,this.squelch=0,this.gain=null,this.sortColumn="frequency",this.presets=[],this.sortedIndices=[],this.editorOpen=!1,this.editorContent={name:"",tunedFrequency:this.tunedFrequency,scale:this.scale,tuningStep:this.tuningStep,scheme:this.scheme,bandwidth:this.bandwidth,stereo:this.stereo,squelch:this.squelch,gain:this.gain}}static get styles(){return[nt,b`
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
          ${Te}
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
          ${this.sortedIndices.map(t=>p`<tr
                data-index=${t}
                class=${t==this.selectedIndex?"active":""}
                @click=${this.onRowClick}
              >
                <td>${this.presets[t].name}</td>
                <td>
                  ${Ti(this.presets[t].tunedFrequency,this.presets[t].scale)}
                </td>
                <td>${this.presets[t].scheme}</td>
                <td>
                  <a href="javascript:0" @click=${this.onRowEditClick}
                    >${_i}</a
                  ><a href="javascript:0" @click=${this.onRowDeleteClick}
                    >${Ri}</a
                  >
                </td>
              </tr>`)}
        </table>
        ${this.presets.length==0?p`<p style="max-width: 50ex">
              You can use Presets to flip quickly to your favorite stations or
              frequencies. Click the
              <button disabled class="buttonIllustration">${Te}</button>
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
            >${Ti(this.editorContent.tunedFrequency,this.editorContent.scale)}</b
          >, Tuning step:
          <b>${Ti(this.editorContent.tuningStep,1)}</b>
        </div>
        <div>
          Modulation:
          <b
            >${this.editorContent.scheme}${Q(this.editorContent.scheme).hasStereo()?this.editorContent.stereo?" Stereo":" Mono":g}</b
          >${Q(this.editorContent.scheme).hasBandwidth()?p`, Bandwidth:
                <b>${Ti(this.editorContent.bandwidth,1)}</b>`:g}
        </div>
        <div>
          Gain:
          <b
            >${this.editorContent.gain===null?"Auto":this.editorContent.gain}</b
          >${Q(this.editorContent.scheme).hasSquelch()?p`, Squelch: <b>${this.editorContent.squelch}</b>`:g}
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
      </rr-window>`}willUpdate(t){super.willUpdate(t),(t.has("presets")||t.has("sortColumn"))&&this.updatePresetLists(),this.findSelectedIndex()}updatePresetLists(){let t=[...this.presets.keys()];t.sort(this.getSortFormula()),this.sortedIndices=t}onAddClick(t){this.editorTitle="New Preset",this.editorIndex=void 0,this.editorContent={name:"",tunedFrequency:this.tunedFrequency,scale:this.scale,tuningStep:this.tuningStep,scheme:this.scheme,bandwidth:this.bandwidth,stereo:this.stereo,squelch:this.squelch,gain:this.gain},this.checkValidEditor(),this.editorOpen=!0}onEditorNameKeydown(t){t.key=="Enter"?(t.preventDefault(),this.onEditorSaveClick()):t.key=="Escape"&&(t.preventDefault(),this.onEditorClosed())}onEditorNameChange(t){let i=t.target.value;this.editorContent.name=i,this.checkValidEditor()}onEditorReplaceClick(){this.editorContent={name:this.editorContent.name,tunedFrequency:this.tunedFrequency,scale:this.scale,tuningStep:this.tuningStep,scheme:this.scheme,bandwidth:this.bandwidth,stereo:this.stereo,squelch:this.squelch,gain:this.gain},this.checkValidEditor()}checkValidEditor(){if(this.editorContent.name==""){this.editorValidationError="Preset name is empty";return}let t=this.presets.findIndex(e=>e.name==this.editorContent.name);if(t>=0&&t!=this.editorIndex){this.editorValidationError="There is another preset with that name";return}if(t=this.presets.findIndex(e=>Wn(e,this.editorContent)),t>=0&&t!=this.editorIndex){this.editorValidationError=`There is an identical preset: ${this.presets[t].name}`;return}this.editorValidationError=void 0}onEditorSaveClick(){let t=[...this.presets];this.editorIndex===void 0||this.editorIndex>=t.length?t.push({...this.editorContent}):t[this.editorIndex]={...this.editorContent},this.editorOpen=!1,this.presets=t,this.dispatchEvent(new ki)}onEditorOpen(){this.presetName&&this.presetName.focus()}onEditorClosed(){this.editorOpen=!1}onRowClick(t){let e=this.getIndex(t);e!==void 0&&(this.selectedIndex=e,this.dispatchEvent(new zs))}onRowEditClick(t){t.stopPropagation();let e=this.getIndex(t);if(e===void 0)return;let i={...this.presets[e]};this.editorTitle=`Editing Preset "${i.name}"`,this.editorIndex=e,this.editorContent=i,this.checkValidEditor(),this.editorOpen=!0}onRowDeleteClick(t){t.stopPropagation();let e=this.getIndex(t);if(e===void 0)return;let i=[...this.presets];i.splice(e,1),this.selectedIndex=void 0,this.presets=i,this.dispatchEvent(new ki)}getIndex(t){let e=t.target;for(;e!=null&&e.tagName!="TR";)e=e.parentElement;if(e==null)return;let i=Number(e.dataset.index);if(!isNaN(i))return i}onHeaderClick(t){let e=t.currentTarget.id,i=`-${e}`;this.sortColumn===e?this.sortColumn=i:this.sortColumn=e,this.dispatchEvent(new Os)}getSortArrow(t){return this.sortColumn===t?hn:this.sortColumn===`-${t}`?ln:g}getSortFormula(){let t=this.sortColumn||"frequency",e=t[0]=="-";e&&(t=t.substring(1));let i;switch(t){case"name":i=(s,n)=>this.presets[s].name.localeCompare(this.presets[n].name);break;case"mode":i=(s,n)=>this.presets[s].scheme.localeCompare(this.presets[n].scheme);break;default:i=(s,n)=>this.presets[s].tunedFrequency-this.presets[n].tunedFrequency;break}return e?(s,n)=>i(n,s):i}findSelectedIndex(){let t=this.presets.findIndex(e=>Wn(e,this));t<0?this.selectedIndex=void 0:this.selectedIndex=t}};E([h({attribute:!1}),T("design:type",Boolean)],M.prototype,"inline",void 0);E([h({attribute:!1}),T("design:type",Boolean)],M.prototype,"hidden",void 0);E([h({attribute:!1}),T("design:type",Number)],M.prototype,"tunedFrequency",void 0);E([h({attribute:!1}),T("design:type",Number)],M.prototype,"scale",void 0);E([h({attribute:!1}),T("design:type",Number)],M.prototype,"tuningStep",void 0);E([h({attribute:!1}),T("design:type",String)],M.prototype,"scheme",void 0);E([h({attribute:!1}),T("design:type",Number)],M.prototype,"bandwidth",void 0);E([h({attribute:!1}),T("design:type",Boolean)],M.prototype,"stereo",void 0);E([h({attribute:!1}),T("design:type",Number)],M.prototype,"squelch",void 0);E([h({attribute:!1}),T("design:type",Object)],M.prototype,"gain",void 0);E([h({attribute:!1}),T("design:type",Number)],M.prototype,"selectedIndex",void 0);E([h({attribute:!1}),T("design:type",String)],M.prototype,"sortColumn",void 0);E([h({attribute:!1}),T("design:type",Array)],M.prototype,"presets",void 0);E([K(),T("design:type",Array)],M.prototype,"sortedIndices",void 0);E([K(),T("design:type",String)],M.prototype,"editorTitle",void 0);E([K(),T("design:type",Boolean)],M.prototype,"editorOpen",void 0);E([K(),T("design:type",Number)],M.prototype,"editorIndex",void 0);E([K(),T("design:type",String)],M.prototype,"editorValidationError",void 0);E([K(),T("design:type",Object)],M.prototype,"editorContent",void 0);E([v("#presets"),T("design:type",typeof(Hn=typeof P<"u"&&P)=="function"?Hn:Object)],M.prototype,"window",void 0);E([v("#presetName"),T("design:type",typeof(jn=typeof HTMLInputElement<"u"&&HTMLInputElement)=="function"?jn:Object)],M.prototype,"presetName",void 0);M=E([y("rr-presets")],M);var zs=class extends Event{constructor(){super("rr-preset-selected",{bubbles:!0,composed:!0})}},ki=class extends Event{constructor(){super("rr-presets-changed",{bubbles:!0,composed:!0})}},Os=class extends Event{constructor(){super("rr-presets-sorted",{bubbles:!0,composed:!0})}};function Wn(r,t){return r.tunedFrequency===t.tunedFrequency&&r.scale===t.scale&&r.tuningStep===t.tuningStep&&r.bandwidth===t.bandwidth&&r.stereo===t.stereo&&r.squelch===t.squelch&&r.gain===t.gain}function Ti(r,t){switch(t){case 1e3:return`${String(r/1e3)} kHz`;case 1e6:return`${String(r/1e6)} MHz`;default:return`${String(r)} Hz`}}var Zt;(function(r){r[r.NoUsbSupport=0]="NoUsbSupport",r[r.NoDeviceSelected=1]="NoDeviceSelected",r[r.UnsupportedDevice=2]="UnsupportedDevice",r[r.UsbTransferError=3]="UsbTransferError",r[r.TunerError=4]="TunerError"})(Zt||(Zt={}));var Bi;(function(r){r[r.Off=0]="Off",r[r.I=1]="I",r[r.Q=2]="Q"})(Bi||(Bi={}));var Vn=new Map([["auto","Auto (RTL-SDR or HackRF)"],["rtlsdr","RTL-SDR"],["hackrf","HackRF One / HackRF Pro"]]);var Kn={0:"No fix",1:"GPS",2:"DGPS",3:"PPS",4:"RTK fixed",5:"RTK float",6:"Estimated",7:"Manual",8:"Simulation"};function Go(r){let t=r.lastIndexOf("*");if(t<0)return!0;let e=0;for(let s=1;s<t;++s)e^=r.charCodeAt(s);let i=parseInt(r.slice(t+1,t+3),16);return!Number.isNaN(i)&&i===e}function qi(r,t){if(!r)return;let e=r.indexOf("."),i=(e<0?r.length:e)-2;if(i<1)return;let s=parseInt(r.slice(0,i),10),n=parseFloat(r.slice(i));if(Number.isNaN(s)||Number.isNaN(n))return;let o=s+n/60;return t==="S"||t==="W"?-o:o}function dt(r){if(r===void 0||r==="")return;let t=parseFloat(r);return Number.isNaN(t)?void 0:t}function Gn(r){return r&&r.length>=6?`${r.slice(0,2)}:${r.slice(2,4)}:${r.slice(4,6)}`:void 0}var Zn=new Map;function Qn(r,t){let e=t.trim();if(!e.startsWith("$")||!Go(e))return;let s=e.slice(1,e.lastIndexOf("*")>=0?e.lastIndexOf("*"):void 0).split(","),n=s[0].length>=5?s[0].slice(-3):s[0];switch(n){case"GGA":{let o=parseInt(s[6]||"0",10);r.fixQuality=Number.isNaN(o)?0:o,r.utcTime=Gn(s[1])??r.utcTime,r.satellites=dt(s[7]),r.hdop=dt(s[8])??r.hdop,r.fixQuality>0&&(r.lat=qi(s[2],s[3])??r.lat,r.lon=qi(s[4],s[5])??r.lon,r.alt=dt(s[9])??r.alt);break}case"RMC":{if(r.utcTime=Gn(s[1])??r.utcTime,s[9]&&s[9].length===6&&(r.utcDate=`${s[9].slice(0,2)}/${s[9].slice(2,4)}/${s[9].slice(4,6)}`),s[2]==="A"){r.lat=qi(s[3],s[4])??r.lat,r.lon=qi(s[5],s[6])??r.lon;let o=dt(s[7]);o!==void 0&&(r.speedKmh=o*1.852),r.headingDeg=dt(s[8])??r.headingDeg,r.fixQuality||(r.fixQuality=1)}break}case"VTG":{let o=dt(s[7]);o!==void 0&&(r.speedKmh=o),r.headingDeg=dt(s[1])??r.headingDeg;break}case"GSA":{let o=parseInt(s[2]||"1",10);r.fixMode=o===3?"3D":o===2?"2D":"No fix",r.pdop=dt(s[15])??r.pdop,r.hdop=dt(s[16])??r.hdop,r.vdop=dt(s[17])??r.vdop;break}case"GSV":{let o=dt(s[3]);if(o!==void 0){let a=s[0].slice(0,2);Zn.set(a,o);let l=0;for(let c of Zn.values())l+=c;r.satellitesInView=l}break}default:return}return r.lastSentence=e,n}var Ni=class{constructor(){this.buf=""}push(t){this.buf+=t;let e=this.buf.split(/\r?\n/);return this.buf=e.pop()??"",this.buf.length>4096&&(this.buf=""),e}};var Jn=new Map([["off","Off"],["phone","Phone / device GPS"],["gmouse","G-MOUSE USB GPS (NMEA)"]]),Xn=[9600,4800,38400,115200],Zo=2500,Ls="webrx.gps.source",Yn=15e3;function Ko(){if(typeof navigator>"u")return!1;let r=navigator.userAgentData;return r&&typeof r.mobile=="boolean"?r.mobile:/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)}function Us(){return typeof navigator<"u"&&"serial"in navigator}function Qo(){return typeof navigator<"u"&&"geolocation"in navigator}function Xo(){return Ko()?"phone":Us()?"gmouse":"phone"}var Hs=class extends EventTarget{constructor(){super(...arguments);this._status={source:"off",state:"off"};this.watchId=null;this.port=null;this.reader=null;this.session=0;this.staleTimer=null}get status(){return this._status}get fix(){return this._status.fix}savedSource(){try{let e=localStorage.getItem(Ls);if(e==="off"||e==="phone"||e==="gmouse")return e}catch{}return Xo()}async start(e,i){await this.stop();try{localStorage.setItem(Ls,e)}catch{}if(e==="off")return;if(e==="phone")return this.startPhone();let s,n=new Promise(o=>s=o);return this.startGMouse(i?.pickPort??!0,s).catch(o=>this.update({source:"gmouse",state:"error",message:String(o)})).finally(()=>s()),n}hasSavedChoice(){try{return localStorage.getItem(Ls)!==null}catch{return!1}}async resume(){let e=this.savedSource();if(e==="phone")return this.start("phone");if(e==="gmouse"&&Us()){if((await navigator.serial.getPorts()).length>0)return this.start("gmouse",{pickPort:!1});this.update({source:"gmouse",state:"off",message:"Press \u201CConnect GPS\u201D to pick the G-MOUSE port"})}}async stop(){if(++this.session,this.watchId!==null&&(navigator.geolocation.clearWatch(this.watchId),this.watchId=null),this.reader){try{await this.reader.cancel(),this.reader.releaseLock()}catch{}this.reader=null}if(this.port){try{await this.port.close()}catch{}this.port=null}this.staleTimer!==null&&clearInterval(this.staleTimer),this.staleTimer=null,this.update({source:"off",state:"off"})}startPhone(){if(!Qo()){this.update({source:"phone",state:"error",message:"This browser has no Geolocation API"});return}this.update({source:"phone",state:"searching",message:"Waiting for location permission / first fix"}),this.watchId=navigator.geolocation.watchPosition(e=>{let i=e.coords;this.setFix({source:"phone",lat:i.latitude,lon:i.longitude,altM:i.altitude??void 0,speedKmh:i.speed!==null&&i.speed!==void 0?i.speed*3.6:void 0,headingDeg:i.heading!==null&&!Number.isNaN(i.heading)?i.heading??void 0:void 0,accuracyM:i.accuracy,fixLabel:i.accuracy<=20?"GPS":i.accuracy<=100?"Approximate":"Coarse",timestamp:e.timestamp||Date.now()})},e=>{let i=this._status.fix;if(e.code!==1&&i&&Date.now()-i.timestamp<Yn)return;let s=e.code===1?"Location permission denied \u2014 allow it in the browser's site settings":e.code===2?"Position unavailable \u2014 turn on location services":"Timed out waiting for a fix \u2014 move to open sky",n=e.code===1?"error":"searching";this._status.state===n&&this._status.message===s||this.update({...this._status,source:"phone",state:n,message:s})},{enableHighAccuracy:!0,maximumAge:2e3,timeout:3e4}),this.watchStale()}async startGMouse(e,i){if(!Us()){this.update({source:"gmouse",state:"error",message:"Web Serial isn't available here \u2014 use Chrome or Edge on a computer, or choose phone GPS"});return}let s=navigator.serial,n=this.session;this.update({source:"gmouse",state:"connecting",message:"Choose the G-MOUSE serial port"});let o;try{let a=await s.getPorts();o=!e&&a.length>0?a[0]:await s.requestPort()}catch{this.update({source:"gmouse",state:"off",message:"No serial port selected"});return}if(n===this.session){this.port=o,this.watchStale(),i();for(let a=0;n===this.session;a=(a+1)%Xn.length){let l=Xn[a];this.update({...this._status,source:"gmouse",state:this._status.fix?"fix":"connecting",baud:l,message:`Listening at ${l} baud\u2026`});let c=await this.readPort(o,l,n);if(c==="stopped")return;if(c==="error"){this.update({source:"gmouse",state:"error",message:"The GPS was disconnected or the port is in use by another program"});return}}}}async readPort(e,i,s){try{await e.open({baudRate:i})}catch{return"error"}let n={},o=new Ni,a=new TextDecoder,l=0,c=e.readable.getReader();this.reader=c;let u,d=new Promise(f=>{u=setTimeout(()=>f(null),Zo)}),m=null;try{for(;s===this.session;){m||(m=c.read());let f=l===0?await Promise.race([m,d]):await m;if(f===null){await c.cancel().catch(()=>{});try{c.releaseLock()}catch{}return this.reader=null,await e.close().catch(()=>{}),"silent"}if(m=null,f.done)break;for(let x of o.push(a.decode(f.value,{stream:!0})))Qn(n,x)&&(++l,this.onNmea(n,i))}}catch{return s!==this.session?"stopped":"error"}finally{clearTimeout(u);try{c.releaseLock()}catch{}}return s===this.session?"error":"stopped"}onNmea(e,i){let s=e.fixQuality??0;s>0&&e.lat!==void 0&&e.lon!==void 0?this.setFix({source:"gmouse",lat:e.lat,lon:e.lon,altM:e.alt,speedKmh:e.speedKmh,headingDeg:e.headingDeg,hdop:e.hdop,accuracyM:e.hdop!==void 0?e.hdop*2.5:void 0,satellites:e.satellites,satellitesInView:e.satellitesInView,fixLabel:`${Kn[s]??"Fix"}${e.fixMode&&e.fixMode!=="No fix"?" "+e.fixMode:""}`,timestamp:Date.now(),utcTime:e.utcTime,nmea:e.lastSentence},i):this.update({source:"gmouse",state:"searching",baud:i,satellitesInView:e.satellitesInView,fix:this._status.fix,message:`Receiving NMEA at ${i} baud \u2014 acquiring satellites${e.satellitesInView?` (${e.satellitesInView} in view)`:""}`})}setFix(e,i){this.update({source:e.source,state:"fix",fix:e,baud:i,satellitesInView:e.satellitesInView})}watchStale(){this.staleTimer!==null&&clearInterval(this.staleTimer),this.staleTimer=setInterval(()=>{let e=this._status;e.state==="fix"&&e.fix&&Date.now()-e.fix.timestamp>Yn&&this.update({...e,state:"searching",message:"Fix lost \u2014 last position kept"})},3e3)}update(e){this._status=e,this.dispatchEvent(new Event("change"))}},I0=new Hs;function to(r,t=5){let e=r.lat>=0?"N":"S",i=r.lon>=0?"E":"W";return`${Math.abs(r.lat).toFixed(t)}\xB0 ${e}, ${Math.abs(r.lon).toFixed(t)}\xB0 ${i}`}var js="webrx.compass.enabled";function Yo(r){return["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round((r%360+360)%360/22.5)%16]}function Jo(r,t,e){let i=Math.PI/180,s=t*i,n=e*i,o=r*i,a=Math.cos(s),l=Math.cos(n),c=Math.cos(o),u=Math.sin(s),d=Math.sin(n),m=Math.sin(o),f=-c*d-m*u*l,x=-m*d+c*u*l,D=Math.atan2(f,x);return D<0&&(D+=2*Math.PI),((Math.abs(t)<25&&Math.abs(e)<25?360-r:D*180/Math.PI)%360+360)%360}function eo(){if(typeof screen<"u"&&screen.orientation&&typeof screen.orientation.angle=="number")return screen.orientation.angle;let r=typeof window<"u"?window.orientation:0;return typeof r=="number"?r:0}function ta(){return typeof window<"u"&&("ondeviceorientationabsolute"in window||"DeviceOrientationEvent"in window)}var Ws=class extends EventTarget{constructor(){super(...arguments);this._status={state:"off"};this.sx=0;this.sy=0;this.primed=!1;this.lastEmit=0;this.watchdog=null;this.onAbsolute=e=>this.handle(e,"absolute");this.onRelative=e=>this.handle(e,"relative")}get status(){return this._status}wasEnabled(){try{return localStorage.getItem(js)!=="0"}catch{return!0}}needsPermissionTap(){let e=window.DeviceOrientationEvent;return!!e&&typeof e.requestPermission=="function"}async start(){try{localStorage.setItem(js,"1")}catch{}if(!ta()){this.update({state:"unavailable",message:"No compass in this browser"});return}let e=window.DeviceOrientationEvent;if(e&&typeof e.requestPermission=="function")try{if(await e.requestPermission()!=="granted"){this.update({state:"denied",message:"Motion & orientation access was not allowed"});return}}catch{this.update({state:"denied",message:"Tap the compass button to allow motion & orientation access"});return}this.stopListening(),this.primed=!1,this.update({state:"starting",message:"Waiting for the compass sensor\u2026"}),"ondeviceorientationabsolute"in window&&window.addEventListener("deviceorientationabsolute",this.onAbsolute),window.addEventListener("deviceorientation",this.onRelative),this.watchdog=setTimeout(()=>{this._status.state==="starting"&&this.update({state:"unavailable",message:"No compass sensor on this device"})},3e3)}stop(){try{localStorage.setItem(js,"0")}catch{}this.stopListening(),this.update({state:"off"})}stopListening(){window.removeEventListener("deviceorientationabsolute",this.onAbsolute),window.removeEventListener("deviceorientation",this.onRelative),this.watchdog!==null&&clearTimeout(this.watchdog),this.watchdog=null}handle(e,i){let s=e.webkitCompassHeading,n,o,a;if(typeof s=="number"&&!Number.isNaN(s)){n=(s+eo())%360,o="ios";let m=e.webkitCompassAccuracy;typeof m=="number"&&m>=0&&(a=m)}else if(e.alpha!==null&&e.beta!==null&&e.gamma!==null){if(i==="relative"&&!e.absolute&&"ondeviceorientationabsolute"in window)return;n=(Jo(e.alpha,e.beta,e.gamma)+eo())%360,o=i==="absolute"||e.absolute?"absolute":"relative"}else return;let l=n*Math.PI/180,c=this.primed?.25:1;this.sx=this.sx*(1-c)+Math.sin(l)*c,this.sy=this.sy*(1-c)+Math.cos(l)*c,this.primed=!0;let u=(Math.atan2(this.sx,this.sy)*180/Math.PI+360)%360,d=Date.now();if(this.watchdog!==null&&(clearTimeout(this.watchdog),this.watchdog=null),d-this.lastEmit<80&&this._status.state==="on"){this._status={...this._status,heading:u,timestamp:d};return}this.lastEmit=d,this.update({state:"on",heading:u,accuracy:a,source:o,timestamp:d,message:o==="relative"?"No north reference: heading is relative":void 0})}update(e){this._status=e,this.dispatchEvent(new Event("change"))}},q0=new Ws;function io(r){return r===void 0||Number.isNaN(r)?"\u2014":`${Math.round(r)%360}\xB0 ${Yo(r)}`}var ea=(()=>{let r=new Set([256e3]);for(let t=1024e3;t<3e6;t+=256e3)r.add(t);for(let t=96e4;t<3e6;t+=192e3)r.add(t);return[...r].sort((t,e)=>t-e)})(),ia=[2e6,24e5,32e5,4e6,5e6,8e6,1e7,125e5,16e6,2e7];function so(r){return r==="hackrf"?ia:ea}function ro(r){return r>=1e6?`${(r/1e6).toLocaleString(void 0,{maximumFractionDigits:3})} Msps`:`${(r/1e3).toLocaleString()} ksps`}var k=function(r,t,e,i){var s=arguments.length,n=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(t,e,n):o(t,e))||n);return s>3&&n&&Object.defineProperty(t,e,n),n},I=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},no;var sa=(()=>{let r=new Array;for(let t=32;t<=32768;t*=2)r.push(t);return r})(),ra=new Map([["default","Default method"],["directSampling","Direct sampling"],["upconverter","External upconverter"]]),na=new Map([["Q","Q"],["I","I"]]),oa=new Map([[50,"Europe"],[75,"USA"]]),aa=new Map([["cpu","Use more CPU"],["latency","Have more latency"],["quality","Have worse quality"]]),A=class extends le(w){constructor(){super(...arguments),this.inline=!1,this.playing=!1,this.sampleRate=1024e3,this.ppm=0,this.fftSize=2048,this.fmDeemph=50,this.biasTee=!1,this.lowFrequencyMethod={name:"default",channel:"Q",frequency:1e8,biasTee:!1},this.performanceTradeoff="cpu",this.sdrKind="auto",this.hackrfAmp=!1,this.dspActive=!1,this.dspSimd=!1,this.wasmDsp=!0,this.gpsSource="off",this.gpsStatus={source:"off",state:"off"},this.canInstall=!1,this.compassStatus={state:"off"}}static get styles(){return[nt,b`
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
      `]}effectiveKind(){return this.connectedSdr?.kind??(this.sdrKind==="hackrf"?"hackrf":"rtlsdr")}renderDevice(){let t=this.connectedSdr;return p`<h3>Device</h3>
      <div>
        <label for="sdrKind">SDR: </label
        ><select id="sdrKind" .disabled=${this.playing} @change=${this.onSdrKindChange}>
          ${[...Vn.entries()].map(([e,i])=>p`<option value=${e} .selected=${this.sdrKind==e}>${i}</option>`)}
        </select>
      </div>
      <div class="note">
        ${t?p`<span class="ok">●</span> ${t.name}${t.detail?p` · ${t.detail}`:g}`:p`Press ▶ to choose a device. RTL-SDR on Windows needs the WinUSB driver
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
      </div>`}renderGps(){let t=this.gpsStatus,e=t.state==="fix"?"ok":t.state==="error"?"err":t.state==="off"?"":"warn";return p`<h3>Location</h3>
      <div class="row">
        <label for="gpsSource">GPS: </label
        ><select id="gpsSource" @change=${this.onGpsSourceChange}>
          ${[...Jn.entries()].map(([i,s])=>p`<option value=${i} .selected=${this.gpsSource==i}>${s}</option>`)}
        </select>
        <button id="gpsConnect" .hidden=${this.gpsSource=="off"} @click=${this.onGpsConnect}>
          ${this.gpsSource=="gmouse"?"Connect GPS\u2026":"Start"}
        </button>
      </div>
      <div class="note">
        <span class=${e}>●</span>
        ${t.fix?p`${to(t.fix)}
              ${t.fix.accuracyM!==void 0?p` ±${t.fix.accuracyM.toFixed(0)} m`:g}
              ${t.fix.satellites!==void 0?p` · ${t.fix.satellites} sats`:g}`:t.message??(t.state==="off"?"Off":t.state)}
      </div>
      <div class="row">
        <label>Compass: </label>
        <span class=${this.compassStatus.state==="on"?"ok":this.compassStatus.state==="off"?"":"warn"}
          >${this.compassStatus.state==="on"?io(this.compassStatus.heading):this.compassStatus.message??(this.compassStatus.state==="off"?"Off":this.compassStatus.state)}</span
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
          ${(()=>{let t=so(this.effectiveKind());return(t.includes(this.sampleRate)?t:[...t,this.sampleRate].sort((i,s)=>i-s)).map(i=>p`<option value=${i} .selected=${this.sampleRate==i}>
                  ${ro(i)}
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
          ${sa.map(t=>p`<option value=${t} .selected=${this.fftSize==t}>
                ${t}
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
          ${oa.entries().map(t=>p`<option value=${t[0]} .selected=${this.fmDeemph==t[0]}>
                ${t[0]}µs &mdash; ${t[1]}
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
          ${ra.entries().map(([t,e])=>p`<option
                value=${String(t)}
                .selected=${this.lowFrequencyMethod.name==t}
              >
                ${e}
              </option>`)}
        </select>
      </div>
      <div .hidden=${this.lowFrequencyMethod.name!="directSampling"||this.effectiveKind()=="hackrf"}>
        <label for="directSamplingChannel">Direct sampling channel: </label
        ><select
          id="directSamplingChannel"
          @change=${this.onDirectSamplingChannelChange}
        >
          ${na.entries().map(([t,e])=>p`<option
                value=${String(t)}
                .selected=${this.lowFrequencyMethod.channel==t}
              >
                ${e}
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
          ${aa.entries().map(t=>p`<option
                value=${t[0]}
                .selected=${this.performanceTradeoff==t[0]}
              >
                ${t[1]}
              </option>`)}
        </select>
      </div>
      ${this.renderEngine()} ${this.renderGps()}
      ${this.canInstall?p`<h3>App</h3>
            <button id="install" @click=${this.onInstall}>Install webRx as an app</button>`:g}
    </rr-window>`}onSdrKindChange(t){this.sdrKind=t.target.selectedOptions[0].value,this.dispatchEvent(new gt("rr-sdr-kind-changed"))}onChooseDevice(){this.dispatchEvent(new gt("rr-choose-device"))}onHackrfAmpChange(t){this.hackrfAmp=t.target.checked,this.dispatchEvent(new gt("rr-hackrf-amp-changed"))}onWasmDspChange(t){this.wasmDsp=t.target.checked,this.dispatchEvent(new gt("rr-wasm-dsp-changed"))}onGpsSourceChange(t){this.gpsSource=t.target.selectedOptions[0].value,this.dispatchEvent(new gt("rr-gps-source-changed"))}onGpsConnect(){this.dispatchEvent(new gt("rr-gps-connect"))}onCompassToggle(){this.dispatchEvent(new gt("rr-compass-toggle"))}onInstall(){this.dispatchEvent(new gt("rr-install-app"))}onSampleRateChange(t){this.sampleRate=Number(t.target.selectedOptions[0].value),this.dispatchEvent(new Vs)}onPpmChange(t){let e=t.target,i=Number(e.value);if(isNaN(i)){e.value=String(this.ppm);return}this.ppm=i,this.dispatchEvent(new Gs)}onFftSizeChange(t){this.fftSize=Number(t.target.selectedOptions[0].value),this.dispatchEvent(new Zs)}onFmDeemphChange(t){this.fmDeemph=Number(t.target.selectedOptions[0].value),this.dispatchEvent(new Ks)}onBiasTeeChange(t){this.biasTee=t.target.checked,this.dispatchEvent(new Qs)}onLowFrequencyMethodChange(t){let e={...this.lowFrequencyMethod};e.name=t.target.selectedOptions[0].value,this.lowFrequencyMethod=e,this.dispatchEvent(new de)}onDirectSamplingChannelChange(t){let e={...this.lowFrequencyMethod};e.channel=t.target.selectedOptions[0].value,this.lowFrequencyMethod=e,this.dispatchEvent(new de)}onUpconverterFrequencyChange(t){let e=t.target,i=Number(e.value);if(isNaN(i)){e.value=String(this.lowFrequencyMethod.frequency);return}let s={...this.lowFrequencyMethod};s.frequency=i,this.lowFrequencyMethod=s,this.dispatchEvent(new de)}onUpconverterBiasTeeChange(t){let e={...this.lowFrequencyMethod};e.biasTee=t.target.checked,this.lowFrequencyMethod=e,this.dispatchEvent(new de)}onPerformanceTradeoffChange(t){this.performanceTradeoff=t.target.selectedOptions[0].value,this.dispatchEvent(new Xs)}};k([h({attribute:!1}),I("design:type",Boolean)],A.prototype,"inline",void 0);k([h({attribute:!1}),I("design:type",Boolean)],A.prototype,"playing",void 0);k([h({attribute:!1}),I("design:type",Number)],A.prototype,"sampleRate",void 0);k([h({attribute:!1}),I("design:type",Number)],A.prototype,"ppm",void 0);k([h({attribute:!1}),I("design:type",Number)],A.prototype,"fftSize",void 0);k([h({attribute:!1}),I("design:type",Number)],A.prototype,"fmDeemph",void 0);k([h({attribute:!1}),I("design:type",Boolean)],A.prototype,"biasTee",void 0);k([h({attribute:!1}),I("design:type",Object)],A.prototype,"lowFrequencyMethod",void 0);k([h({attribute:!1}),I("design:type",String)],A.prototype,"performanceTradeoff",void 0);k([h({attribute:!1}),I("design:type",Object)],A.prototype,"sdrKind",void 0);k([h({attribute:!1}),I("design:type",Object)],A.prototype,"connectedSdr",void 0);k([h({attribute:!1}),I("design:type",Boolean)],A.prototype,"hackrfAmp",void 0);k([h({attribute:!1}),I("design:type",Boolean)],A.prototype,"dspActive",void 0);k([h({attribute:!1}),I("design:type",Boolean)],A.prototype,"dspSimd",void 0);k([h({attribute:!1}),I("design:type",Boolean)],A.prototype,"wasmDsp",void 0);k([h({attribute:!1}),I("design:type",Object)],A.prototype,"gpsSource",void 0);k([h({attribute:!1}),I("design:type",Object)],A.prototype,"gpsStatus",void 0);k([h({attribute:!1}),I("design:type",Boolean)],A.prototype,"canInstall",void 0);k([h({attribute:!1}),I("design:type",Object)],A.prototype,"compassStatus",void 0);k([v("rr-window"),I("design:type",typeof(no=typeof P<"u"&&P)=="function"?no:Object)],A.prototype,"window",void 0);A=k([y("rr-settings")],A);var gt=class extends Event{constructor(t){super(t,{bubbles:!0,composed:!0})}},Vs=class extends Event{constructor(){super("rr-sample-rate-changed",{bubbles:!0,composed:!0})}},Gs=class extends Event{constructor(){super("rr-ppm-changed",{bubbles:!0,composed:!0})}},Zs=class extends Event{constructor(){super("rr-fft-size-changed",{bubbles:!0,composed:!0})}},Ks=class extends Event{constructor(){super("rr-fm-deemph-changed",{bubbles:!0,composed:!0})}},Qs=class extends Event{constructor(){super("rr-bias-tee-changed",{bubbles:!0,composed:!0})}},de=class extends Event{constructor(){super("rr-low-frequency-method-changed",{bubbles:!0,composed:!0})}},Xs=class extends Event{constructor(){super("rr-performance-tradeoff-changed",{bubbles:!0,composed:!0})}};var N=function(r,t,e,i){var s=arguments.length,n=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(o=r[a])&&(n=(s<3?o(n):s>3?o(t,e,n):o(t,e))||n);return s>3&&n&&Object.defineProperty(t,e,n),n},Mt=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},oo,ao,lo,ho,ue=class extends w{connectedCallback(){super.connectedCallback(),this.observer?.disconnect(),this.observer=new IntersectionObserver(t=>this.onVisible(t),{threshold:[.05,.1]}),this.observer.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.observer?.disconnect(),this.observer=void 0}onVisible(t){t[0].intersectionRatio>.09?this.player===void 0&&(this.player=fo.subscribe(e=>this.addSpectrum(e))):t[0].intersectionRatio<=.05&&this.player!==void 0&&(fo.unsubscribe(this.player),this.player=void 0)}},Ys=class extends ue{static get styles(){return[b`
        #container {
          position: relative;
          width: 133%;
          aspect-ratio: 2/1;
          transform: scale(0.75);
          transform-origin: left top;
          margin-bottom: -16.5%;
        }

        rr-spectrum {
          height: 100%;
        }
      `]}render(){return p`<div id="container">
      <rr-spectrum
        id="spectrum"
        .centerFrequency=${939e5}
        .bandwidth=${1e6}
        .frequencyScale=${1e6}
      ></rr-spectrum>
    </div>`}addSpectrum(t){this.spectrumView?.addFloatSpectrum(939e5,t)}};N([v("#spectrum"),Mt("design:type",typeof(oo=typeof C<"u"&&C)=="function"?oo:Object)],Ys.prototype,"spectrumView",void 0);Ys=N([y("rr-demo-spectrum")],Ys);var Js=class extends ue{static get styles(){return[b`
        #container {
          position: relative;
          width: 100%;
          aspect-ratio: 5/1;
        }

        rr-scope {
          height: 100%;
        }
      `]}render(){return p`<div id="container">
      <rr-scope
        id="scope"
        .centerFrequency=${939e5}
        .bandwidth=${1e6}
        .frequencyScale=${1e6}
      ></rr-scope>
    </div>`}addSpectrum(t){this.scopeView?.addFloatSpectrum(t)}};N([v("#scope"),Mt("design:type",typeof(ao=typeof j<"u"&&j)=="function"?ao:Object)],Js.prototype,"scopeView",void 0);Js=N([y("rr-demo-scope")],Js);var tr=class extends ue{static get styles(){return[b`
        #container {
          position: relative;
          width: 100%;
          aspect-ratio: 5/1;
          background-color: black;
        }

        rr-waterfall {
          height: 100%;
        }
      `]}render(){return p`<div id="container">
      <rr-waterfall id="waterfall"></rr-waterfall>
    </div>`}addSpectrum(t){this.waterfallView?.addFloatSpectrum(939e5,t)}};N([v("#waterfall"),Mt("design:type",typeof(lo=typeof W<"u"&&W)=="function"?lo:Object)],tr.prototype,"waterfallView",void 0);tr=N([y("rr-demo-waterfall")],tr);var co=class extends w{static get styles(){return[b`
        #controls {
          position: relative;
          width: 100%;
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
          min-width: 250px;
        }
      `]}render(){return p` <div id="controls">
      <rr-decibel-range></rr-decibel-range>
      <div id="zoomControls">
        <rr-zoombar></rr-zoombar>
        <rr-scrollbar></rr-scrollbar>
      </div>
    </div>`}};co=N([y("rr-demo-bottombar")],co);var zi=class extends w{constructor(){super(...arguments),this.scheme="WBFM",this.mode=Xe(this.scheme)}static get styles(){return[b`
        :host {
          display: block;
        }

        #container {
          position: relative;
        }

        rr-main-controls {
          height: 100%;
        }
      `]}render(){return p`<div id="container">
      <rr-main-controls
        id="controls"
        .inline=${!0}
        .showHelp=${!1}
        .centerFrequency=${939e5}
        .frequencyScale=${1e6}
        .scheme=${this.mode.scheme}
        .bandwidth=${Q(this.mode).getBandwidth()}
        .stereo=${Q(this.mode).getStereo()}
        .stereoStatus=${!0}
        .squelch=${Q(this.mode).getSquelch()}
        @rr-scheme-changed=${this.onSchemeChanged}
      ></rr-main-controls>
    </div>`}onSchemeChanged(t){this.scheme=t.target.scheme}willUpdate(t){t.has("scheme")&&(this.mode=Xe(this.scheme))}};N([h({type:String,reflect:!0}),Mt("design:type",String)],zi.prototype,"scheme",void 0);N([K(),Mt("design:type",Object)],zi.prototype,"mode",void 0);zi=N([y("rr-demo-controls")],zi);var uo=class extends w{static get styles(){return[b`
        :host {
          display: block;
        }

        #container {
          position: relative;
        }

        rr-settings {
          height: 100%;
        }
      `]}render(){return p`<div id="container">
      <rr-settings id="settings" .inline=${!0}></rr-settings>
    </div>`}};uo=N([y("rr-demo-settings")],uo);var po=class extends w{static get styles(){return[b`
        :host {
          display: block;
        }

        #container {
          position: relative;
          width: 100%;
        }

        rr-presets {
          height: 100%;
        }
      `]}render(){return p`<div id="container">
      <rr-presets
        id="presets"
        .inline=${!0}
        .presets=${[{name:"Rock & Roll FM station",tunedFrequency:897e5,scale:1e6,tuningStep:1e5,scheme:"WBFM",bandwidth:15e4,stereo:!0,squelch:0,gain:30},{name:"Talk Radio AM",tunedFrequency:12e5,scale:1e3,tuningStep:1e4,scheme:"AM",bandwidth:1e4,stereo:!1,squelch:0,gain:30},{name:"Frequency standard",tunedFrequency:1e7,scale:1,tuningStep:1e4,scheme:"AM",bandwidth:1e4,stereo:!1,squelch:0,gain:30},{name:"Ham radio net",tunedFrequency:143e5,scale:1e3,tuningStep:1e3,scheme:"USB",bandwidth:2800,stereo:!1,squelch:0,gain:30}]}
      ></rr-presets>
    </div>`}};po=N([y("rr-demo-presets")],po);var mo=new Map([["play",bi],["stop",gi],["add",Te],["edit",_i],["delete",Ri],["presets",Di],["settings",wi],["zoom-in",xi],["zoom-out",Si],["scroll-left",yi],["scroll-right",vi]]),er=class extends w{constructor(){super(...arguments),this.name="play"}static get styles(){return[b`
        :host {
          display: inline-block;
          vertical-align: middle;
          margin-top: -2px;
          margin-bottom: -2px;
        }
        button {
          padding-inline: 0;
          width: 24px;
          height: 24px;
        }
        button > svg {
          display: block;
          width: 16px;
          height: 16px;
          margin: auto;
        }
      `]}render(){return p`<button>${mo.get(this.name)}</button>`}};N([h({type:String,reflect:!0}),Mt("design:type",String)],er.prototype,"name",void 0);er=N([y("rr-demo-button")],er);var ir=class extends w{constructor(){super(...arguments),this.name="play"}static get styles(){return[b`
        :host {
          display: inline-block;
          vertical-align: middle;
          margin-top: -2px;
          margin-bottom: -2px;
        }
        button > svg {
          display: inline-block;
          width: 16px;
          height: 16px;
          margin: auto;
        }
      `]}render(){return p`${mo.get(this.name)}`}};N([h({type:String,reflect:!0}),Mt("design:type",String)],ir.prototype,"name",void 0);ir=N([y("rr-demo-icon")],ir);var Oi=class extends ue{constructor(){super(...arguments),this.highlight={point:.5,band:{left:.5-.035,right:.5+.035}}}static get styles(){return[b`
        #container {
          position: relative;
          width: 133%;
          aspect-ratio: 2/1;
          transform: scale(0.75);
          transform-origin: left top;
          margin-bottom: -16.5%;
        }

        rr-spectrum {
          height: 100%;
        }
      `]}render(){return p`<div id="container">
      <rr-spectrum
        id="spectrum"
        .centerFrequency=${939e5}
        .bandwidth=${1e6}
        .frequencyScale=${1e6}
        .highlight=${this.highlight}
        .highlightDraggableLeft=${!0}
        .highlightDraggablePoint=${!0}
        .highlightDraggableRight=${!0}
      ></rr-spectrum>
    </div>`}addSpectrum(t){this.spectrumView?.addFloatSpectrum(939e5,t)}};N([K(),Mt("design:type",Object)],Oi.prototype,"highlight",void 0);N([v("#spectrum"),Mt("design:type",typeof(ho=typeof C<"u"&&C)=="function"?ho:Object)],Oi.prototype,"spectrumView",void 0);Oi=N([y("rr-demo-highlight")],Oi);var bt=class{constructor(t,e,i){this.fraction=t,this.width=e,this.pulses=i,this.sample=0}add(t){let e=t.length,i=0;for(let s=0;s<this.pulses.length;++s){let{max:n,period:o,phase:a}=this.pulses[s],l=a+2*Math.PI*this.sample/o;i+=n*(Math.cos(l)+1)/2}for(let s=0;s<e;++s){let n=s/e+.5;n>1&&(n-=1);let o=this.fraction-n,a=1-o*o/this.width;t[s]=t[s]+Math.max(0,a*i)}this.sample+=1}};function Oe(r,t,e){for(let i=0;i<r.length;i+=e){let s=t*Math.random();for(let n=0;n<e;++n)r[i+n]+=s}}var sr=class{constructor(t){this.generators=t,this.spectrumAdders=[],this.playing=!1,this.spectrum=new Float32Array(2048)}subscribe(t){let e=this.spectrumAdders.push(t);return this.play(),e-1}unsubscribe(t){if(!(t>=this.spectrumAdders.length))for(this.spectrumAdders[t]=null;this.spectrumAdders.length>0&&this.spectrumAdders[this.spectrumAdders.length-1]==null;)this.spectrumAdders.pop()}play(){this.playing||(this.playing=!0,requestAnimationFrame(t=>this.frame(t,0)))}stop(){this.playing=!1}frame(t,e){if(this.spectrumAdders.length==0&&(this.playing=!1),!this.playing)return;let s=Math.floor(20*t/1e3);if(s>e){this.spectrum.fill(-105),Oe(this.spectrum,8,1),Oe(this.spectrum,6,2),Oe(this.spectrum,4,4),Oe(this.spectrum,2,8),Oe(this.spectrum,1,16);for(let n of this.generators)n.add(this.spectrum);for(let n of this.spectrumAdders)n?.(this.spectrum)}requestAnimationFrame(n=>this.frame(n,s))}};function la(){return[new bt(.1,.001,[{max:20,period:10,phase:1},{max:10,period:7,phase:2},{max:7,period:3.2,phase:3}]),new bt(.1,1e-4,[{max:10,period:10,phase:1},{max:5,period:7,phase:2},{max:3.5,period:3.2,phase:3}]),new bt(.5,.001,[{max:13,period:9,phase:4},{max:15,period:11,phase:5},{max:4,period:4,phase:6},{max:4,period:7,phase:7}]),new bt(.5,1e-4,[{max:9,period:9,phase:4},{max:10,period:11,phase:5},{max:3,period:4,phase:6},{max:3,period:7,phase:7}]),new bt(.7,.001,[{max:4,period:6,phase:8},{max:5,period:10,phase:9},{max:3,period:4,phase:10}]),new bt(.7,1e-4,[{max:2,period:6,phase:8},{max:2.5,period:10,phase:9},{max:1.5,period:4,phase:10}]),new bt(.9,.001,[{max:12,period:7,phase:11},{max:17,period:12,phase:12},{max:8,period:5,phase:13}]),new bt(.9,1e-4,[{max:6,period:7,phase:11},{max:8,period:12,phase:12},{max:4,period:5,phase:13}])]}var fo=new sr(la());function ha(){let r=0,t=document.createElement("UL"),e=document.body.firstElementChild;for(;e!=null;){let i=e.tagName=="H1"?1:e.tagName=="H2"?2:0;if(i>0&&!e.classList.contains("title")){if(r>0&&i>r){let n=document.createElement("UL");t.lastElementChild?.append(n),t=n}else i<r&&(t=t.parentElement);let s=document.createElement("LI");if(e.id){let n=document.createElement("A");n.textContent=e.textContent,n.href="#"+e.id,s.append(n)}else s.textContent=e.textContent;t.appendChild(s),r=i}e=e.nextElementSibling}for(;t.parentElement!=null;)t=t.parentElement;t.hasChildNodes()&&document.getElementById("toc")?.append(t)}window.addEventListener("load",ha);})();
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
