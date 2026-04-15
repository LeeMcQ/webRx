"use strict";(()=>{var qe=globalThis,Te=qe.ShadowRoot&&(qe.ShadyCSS===void 0||qe.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Si=Symbol(),rr=new WeakMap,le=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==Si)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o,e=this.t;if(Te&&t===void 0){let i=e!==void 0&&e.length===1;i&&(t=rr.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&rr.set(e,t))}return t}toString(){return this.cssText}},or=r=>new le(typeof r=="string"?r:r+"",void 0,Si),b=(r,...t)=>{let e=r.length===1?r[0]:t.reduce((i,s,o)=>i+(n=>{if(n._$cssResult$===!0)return n.cssText;if(typeof n=="number")return n;throw Error("Value passed to 'css' function must be a 'css' function result: "+n+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+r[o+1],r[0]);return new le(e,r,Si)},$i=(r,t)=>{if(Te)r.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(let e of t){let i=document.createElement("style"),s=qe.litNonce;s!==void 0&&i.setAttribute("nonce",s),i.textContent=e.cssText,r.appendChild(i)}},Be=Te?r=>r:r=>r instanceof CSSStyleSheet?(t=>{let e="";for(let i of t.cssRules)e+=i.cssText;return or(e)})(r):r;var{is:Co,defineProperty:Mo,getOwnPropertyDescriptor:Po,getOwnPropertyNames:Eo,getOwnPropertySymbols:_o,getPrototypeOf:Ao}=Object,Oe=globalThis,nr=Oe.trustedTypes,zo=nr?nr.emptyScript:"",Fo=Oe.reactiveElementPolyfillSupport,he=(r,t)=>r,ce={toAttribute(r,t){switch(t){case Boolean:r=r?zo:null;break;case Object:case Array:r=r==null?r:JSON.stringify(r)}return r},fromAttribute(r,t){let e=r;switch(t){case Boolean:e=r!==null;break;case Number:e=r===null?null:Number(r);break;case Object:case Array:try{e=JSON.parse(r)}catch{e=null}}return e}},Ie=(r,t)=>!Co(r,t),ar={attribute:!0,type:String,converter:ce,reflect:!1,hasChanged:Ie};Symbol.metadata??=Symbol("metadata"),Oe.litPropertyMetadata??=new WeakMap;var ft=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=ar){if(e.state&&(e.attribute=!1),this._$Ei(),this.elementProperties.set(t,e),!e.noAccessor){let i=Symbol(),s=this.getPropertyDescriptor(t,i,e);s!==void 0&&Mo(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){let{get:s,set:o}=Po(this.prototype,t)??{get(){return this[e]},set(n){this[e]=n}};return{get(){return s?.call(this)},set(n){let a=s?.call(this);o.call(this,n),this.requestUpdate(t,a,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??ar}static _$Ei(){if(this.hasOwnProperty(he("elementProperties")))return;let t=Ao(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(he("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(he("properties"))){let e=this.properties,i=[...Eo(e),..._o(e)];for(let s of i)this.createProperty(s,e[s])}let t=this[Symbol.metadata];if(t!==null){let e=litPropertyMetadata.get(t);if(e!==void 0)for(let[i,s]of e)this.elementProperties.set(i,s)}this._$Eh=new Map;for(let[e,i]of this.elementProperties){let s=this._$Eu(e,i);s!==void 0&&this._$Eh.set(s,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){let e=[];if(Array.isArray(t)){let i=new Set(t.flat(1/0).reverse());for(let s of i)e.unshift(Be(s))}else t!==void 0&&e.push(Be(t));return e}static _$Eu(t,e){let i=e.attribute;return i===!1?void 0:typeof i=="string"?i:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){let t=new Map,e=this.constructor.elementProperties;for(let i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){let t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return $i(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$EC(t,e){let i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(s!==void 0&&i.reflect===!0){let o=(i.converter?.toAttribute!==void 0?i.converter:ce).toAttribute(e,i.type);this._$Em=t,o==null?this.removeAttribute(s):this.setAttribute(s,o),this._$Em=null}}_$AK(t,e){let i=this.constructor,s=i._$Eh.get(t);if(s!==void 0&&this._$Em!==s){let o=i.getPropertyOptions(s),n=typeof o.converter=="function"?{fromAttribute:o.converter}:o.converter?.fromAttribute!==void 0?o.converter:ce;this._$Em=s,this[s]=n.fromAttribute(e,o.type),this._$Em=null}}requestUpdate(t,e,i){if(t!==void 0){if(i??=this.constructor.getPropertyOptions(t),!(i.hasChanged??Ie)(this[t],e))return;this.P(t,e,i)}this.isUpdatePending===!1&&(this._$ES=this._$ET())}P(t,e,i){this._$AL.has(t)||this._$AL.set(t,e),i.reflect===!0&&this._$Em!==t&&(this._$Ej??=new Set).add(t)}async _$ET(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}let t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[s,o]of this._$Ep)this[s]=o;this._$Ep=void 0}let i=this.constructor.elementProperties;if(i.size>0)for(let[s,o]of i)o.wrapped!==!0||this._$AL.has(s)||this[s]===void 0||this.P(s,this[s],o)}let t=!1,e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(i=>i.hostUpdate?.()),this.update(e)):this._$EU()}catch(i){throw t=!1,this._$EU(),i}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EU(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Ej&&=this._$Ej.forEach(e=>this._$EC(e,this[e])),this._$EU()}updated(t){}firstUpdated(t){}};ft.elementStyles=[],ft.shadowRootOptions={mode:"open"},ft[he("elementProperties")]=new Map,ft[he("finalized")]=new Map,Fo?.({ReactiveElement:ft}),(Oe.reactiveElementVersions??=[]).push("2.0.4");var Ai=globalThis,Ne=Ai.trustedTypes,lr=Ne?Ne.createPolicy("lit-html",{createHTML:r=>r}):void 0,fr="$lit$",$t=`lit$${Math.random().toFixed(9).slice(2)}$`,mr="?"+$t,Ro=`<${mr}>`,Ft=document,pe=()=>Ft.createComment(""),ue=r=>r===null||typeof r!="object"&&typeof r!="function",zi=Array.isArray,qo=r=>zi(r)||typeof r?.[Symbol.iterator]=="function",Di=`[ 	
\f\r]`,de=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,hr=/-->/g,cr=/>/g,At=RegExp(`>|${Di}(?:([^\\s"'>=/]+)(${Di}*=${Di}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),dr=/'/g,pr=/"/g,gr=/^(?:script|style|textarea|title)$/i,Fi=r=>(t,...e)=>({_$litType$:r,strings:t,values:e}),u=Fi(1),z=Fi(2),ln=Fi(3),Rt=Symbol.for("lit-noChange"),m=Symbol.for("lit-nothing"),ur=new WeakMap,zt=Ft.createTreeWalker(Ft,129);function br(r,t){if(!zi(r)||!r.hasOwnProperty("raw"))throw Error("invalid template strings array");return lr!==void 0?lr.createHTML(t):t}var To=(r,t)=>{let e=r.length-1,i=[],s,o=t===2?"<svg>":t===3?"<math>":"",n=de;for(let a=0;a<e;a++){let l=r[a],c,d,p=-1,v=0;for(;v<l.length&&(n.lastIndex=v,d=n.exec(l),d!==null);)v=n.lastIndex,n===de?d[1]==="!--"?n=hr:d[1]!==void 0?n=cr:d[2]!==void 0?(gr.test(d[2])&&(s=RegExp("</"+d[2],"g")),n=At):d[3]!==void 0&&(n=At):n===At?d[0]===">"?(n=s??de,p=-1):d[1]===void 0?p=-2:(p=n.lastIndex-d[2].length,c=d[1],n=d[3]===void 0?At:d[3]==='"'?pr:dr):n===pr||n===dr?n=At:n===hr||n===cr?n=de:(n=At,s=void 0);let f=n===At&&r[a+1].startsWith("/>")?" ":"";o+=n===de?l+Ro:p>=0?(i.push(c),l.slice(0,p)+fr+l.slice(p)+$t+f):l+$t+(p===-2?a:f)}return[br(r,o+(r[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),i]},fe=class r{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let o=0,n=0,a=t.length-1,l=this.parts,[c,d]=To(t,e);if(this.el=r.createElement(c,i),zt.currentNode=this.el.content,e===2||e===3){let p=this.el.content.firstChild;p.replaceWith(...p.childNodes)}for(;(s=zt.nextNode())!==null&&l.length<a;){if(s.nodeType===1){if(s.hasAttributes())for(let p of s.getAttributeNames())if(p.endsWith(fr)){let v=d[n++],f=s.getAttribute(p).split($t),S=/([.?@])?(.*)/.exec(v);l.push({type:1,index:o,name:S[2],strings:f,ctor:S[1]==="."?Mi:S[1]==="?"?Pi:S[1]==="@"?Ei:jt}),s.removeAttribute(p)}else p.startsWith($t)&&(l.push({type:6,index:o}),s.removeAttribute(p));if(gr.test(s.tagName)){let p=s.textContent.split($t),v=p.length-1;if(v>0){s.textContent=Ne?Ne.emptyScript:"";for(let f=0;f<v;f++)s.append(p[f],pe()),zt.nextNode(),l.push({type:2,index:++o});s.append(p[v],pe())}}}else if(s.nodeType===8)if(s.data===mr)l.push({type:2,index:o});else{let p=-1;for(;(p=s.data.indexOf($t,p+1))!==-1;)l.push({type:7,index:o}),p+=$t.length-1}o++}}static createElement(t,e){let i=Ft.createElement("template");return i.innerHTML=t,i}};function Ht(r,t,e=r,i){if(t===Rt)return t;let s=i!==void 0?e._$Co?.[i]:e._$Cl,o=ue(t)?void 0:t._$litDirective$;return s?.constructor!==o&&(s?._$AO?.(!1),o===void 0?s=void 0:(s=new o(r),s._$AT(r,e,i)),i!==void 0?(e._$Co??=[])[i]=s:e._$Cl=s),s!==void 0&&(t=Ht(r,s._$AS(r,t.values),s,i)),t}var Ci=class{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){let{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??Ft).importNode(e,!0);zt.currentNode=s;let o=zt.nextNode(),n=0,a=0,l=i[0];for(;l!==void 0;){if(n===l.index){let c;l.type===2?c=new me(o,o.nextSibling,this,t):l.type===1?c=new l.ctor(o,l.name,l.strings,this,t):l.type===6&&(c=new _i(o,this,t)),this._$AV.push(c),l=i[++a]}n!==l?.index&&(o=zt.nextNode(),n++)}return zt.currentNode=Ft,s}p(t){let e=0;for(let i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}},me=class r{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=m,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode,e=this._$AM;return e!==void 0&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=Ht(this,t,e),ue(t)?t===m||t==null||t===""?(this._$AH!==m&&this._$AR(),this._$AH=m):t!==this._$AH&&t!==Rt&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):qo(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==m&&ue(this._$AH)?this._$AA.nextSibling.data=t:this.T(Ft.createTextNode(t)),this._$AH=t}$(t){let{values:e,_$litType$:i}=t,s=typeof i=="number"?this._$AC(t):(i.el===void 0&&(i.el=fe.createElement(br(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{let o=new Ci(s,this),n=o.u(this.options);o.p(e),this.T(n),this._$AH=o}}_$AC(t){let e=ur.get(t.strings);return e===void 0&&ur.set(t.strings,e=new fe(t)),e}k(t){zi(this._$AH)||(this._$AH=[],this._$AR());let e=this._$AH,i,s=0;for(let o of t)s===e.length?e.push(i=new r(this.O(pe()),this.O(pe()),this,this.options)):i=e[s],i._$AI(o),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t&&t!==this._$AB;){let i=t.nextSibling;t.remove(),t=i}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}},jt=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,o){this.type=1,this._$AH=m,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=o,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=m}_$AI(t,e=this,i,s){let o=this.strings,n=!1;if(o===void 0)t=Ht(this,t,e,0),n=!ue(t)||t!==this._$AH&&t!==Rt,n&&(this._$AH=t);else{let a=t,l,c;for(t=o[0],l=0;l<o.length-1;l++)c=Ht(this,a[i+l],e,l),c===Rt&&(c=this._$AH[l]),n||=!ue(c)||c!==this._$AH[l],c===m?t=m:t!==m&&(t+=(c??"")+o[l+1]),this._$AH[l]=c}n&&!s&&this.j(t)}j(t){t===m?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},Mi=class extends jt{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===m?void 0:t}},Pi=class extends jt{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==m)}},Ei=class extends jt{constructor(t,e,i,s,o){super(t,e,i,s,o),this.type=5}_$AI(t,e=this){if((t=Ht(this,t,e,0)??m)===Rt)return;let i=this._$AH,s=t===m&&i!==m||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,o=t!==m&&(i===m||s);s&&this.element.removeEventListener(this.name,this,i),o&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}},_i=class{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){Ht(this,t)}};var Bo=Ai.litHtmlPolyfillSupport;Bo?.(fe,me),(Ai.litHtmlVersions??=[]).push("3.2.1");var yr=(r,t,e)=>{let i=e?.renderBefore??t,s=i._$litPart$;if(s===void 0){let o=e?.renderBefore??null;i._$litPart$=s=new me(t.insertBefore(pe(),o),o,void 0,e??{})}return s._$AI(r),s};var g=class extends ft{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){let e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=yr(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return Rt}};g._$litElement$=!0,g.finalized=!0,globalThis.litElementHydrateSupport?.({LitElement:g});var Oo=globalThis.litElementPolyfillSupport;Oo?.({LitElement:g});(globalThis.litElementVersions??=[]).push("4.1.1");var y=r=>(t,e)=>{e!==void 0?e.addInitializer(()=>{customElements.define(r,t)}):customElements.define(r,t)};var Io={attribute:!0,type:String,converter:ce,reflect:!1,hasChanged:Ie},No=(r=Io,t,e)=>{let{kind:i,metadata:s}=e,o=globalThis.litPropertyMetadata.get(s);if(o===void 0&&globalThis.litPropertyMetadata.set(s,o=new Map),o.set(e.name,r),i==="accessor"){let{name:n}=e;return{set(a){let l=t.get.call(this);t.set.call(this,a),this.requestUpdate(n,l,r)},init(a){return a!==void 0&&this.P(n,void 0,r),a}}}if(i==="setter"){let{name:n}=e;return function(a){let l=this[n];t.call(this,a),this.requestUpdate(n,l,r)}}throw Error("Unsupported decorator location: "+i)};function h(r){return(t,e)=>typeof e=="object"?No(r,t,e):((i,s,o)=>{let n=s.hasOwnProperty(o);return s.constructor.createProperty(o,n?{...i,wrapped:!0}:i),n?Object.getOwnPropertyDescriptor(s,o):void 0})(r,t,e)}function Z(r){return h({...r,state:!0,attribute:!1})}var qt=(r,t,e)=>(e.configurable=!0,e.enumerable=!0,Reflect.decorate&&typeof t!="object"&&Object.defineProperty(r,t,e),e);function w(r,t){return(e,i,s)=>{let o=n=>n.renderRoot?.querySelector(r)??null;if(t){let{get:n,set:a}=typeof i=="object"?e:s??(()=>{let l=Symbol();return{get(){return this[l]},set(c){this[l]=c}}})();return qt(e,i,{get(){let l=n.call(this);return l===void 0&&(l=o(this),(l!==null||this.hasUpdated)&&a.call(this,l)),l}})}return qt(e,i,{get(){return o(this)}})}}function Tt(r,t,e){Ri.set(r,{demod:t,config:e})}function vr(){return[...Ri.keys()]}function Le(r){let t=wr(r);return new t.config(r).mode}function V(r){let t=wr(r);return new t.config(r)}var K=class{base;constructor(t){this.base=t}get mode(){return typeof this.base=="string"&&(this.base=this.create(this.base)),this.base}set mode(t){this.base=t}hasStereo(){return!1}getStereo(){return!1}setStereo(t){return this}hasBandwidth(){return!1}setBandwidth(t){return this}hasSquelch(){return!1}getSquelch(){return 0}setSquelch(t){return this}},Ri=new Map;function wr(r){let t=typeof r=="string"?r:r.scheme,e=Ri.get(t);if(!e)throw`Scheme "${t}" was not registered.`;return e}var qi=class{make;constructor(t,e,i){this.make=t,this.buffers=[...Array(e).keys()].map(()=>t(i||0)),this.current=0}buffers;current;get(t){let e=this.buffers[this.current];return e.length<t&&(e=this.make(t),this.buffers[this.current]=e),this.current=(this.current+1)%this.buffers.length,e.length==t?e:e.subarray(0,t)}};var F=class extends qi{constructor(t,e){super(i=>new Float32Array(i),t,e)}},Bt=class{constructor(t,e){this.pools=new F(t*2,e)}pools;get(t){return[this.pools.get(t),this.pools.get(t)]}},Ti=class{buffer;constructor(t){this.buffer=t,this.readPos=0,this.writePos=0,this.filled=0}readPos;writePos;filled;get capacity(){return this.buffer.length}get available(){return this.filled}clear(){this.readPos=0,this.writePos=0,this.filled=0}fill(t,e){if(e===void 0||e>=this.buffer.length){this.buffer.fill(t),this.readPos=0,this.writePos=0,this.filled=this.buffer.length;return}let i=e,s=this.writePos;for(;i>0;){let o=Math.min(i,this.buffer.length-this.writePos);this.buffer.subarray(s,s+o).fill(t),s=(s+o)%this.buffer.length,i-=o}this.writePos=s,this.filled=Math.min(this.buffer.length,this.filled+e),this.filled==this.buffer.length&&(this.readPos=this.writePos)}store(t){let e=Math.min(t.length,this.buffer.length),{dstOffset:i}=this.doCopy(e,t,t.length-e,this.buffer,this.writePos);this.writePos=i,this.filled=Math.min(this.buffer.length,this.filled+e),this.filled==this.buffer.length&&(this.readPos=this.writePos)}moveTo(t){let e=Math.min(t.length,this.buffer.length,this.filled);if(e==0)return 0;let{srcOffset:i}=this.doCopy(e,this.buffer,this.readPos,t,0);return this.readPos=i,this.filled-=e,e}consume(t){let e=Math.min(this.filled,t);this.readPos=(this.readPos+e)%this.buffer.length,this.filled-=e}copyTo(t){let e=Math.min(t.length,this.buffer.length),i=(this.writePos+this.buffer.length-e)%this.buffer.length;this.doCopy(e,this.buffer,i,t,0)}doCopy(t,e,i,s,o){for(;t>0;){let n=Math.min(t,e.length-i,s.length-o);s.set(e.subarray(i,i+n),o),i=(i+n)%e.length,o=(o+n)%s.length,t-=n}return{srcOffset:i,dstOffset:o}}},Ot=class extends Ti{constructor(t){super(new Float32Array(t))}};function O(r,t,e,i){i===void 0&&(i=1),e+=(e+1)%2;let s=t/r,o=new Float32Array(e),n=Math.floor(e/2),a=0;for(let l=0;l<e;++l){let c;l==n?c=2*Math.PI*s:(c=Math.sin(2*Math.PI*s*(l-n))/(l-n),c*=.54-.46*Math.cos(2*Math.PI*l/(e-1))),a+=c,o[l]=c}a/=i;for(let l=0;l<e;++l)o[l]/=a;return o}function xr(r){r+=(r+1)%2;let t=Math.floor(r/2),e=new Float32Array(r);for(let i=0;i<e.length;++i)i%2==0&&(e[i]=2/(Math.PI*(t-i)));return e}function Bi(r){if(r<4&&(r=4),!(r-1&r))return r;let t=1;for(;t<r;)t<<=1;return t}var ge=class r{length;static ofLength(t){return new r(Bi(t))}constructor(t){this.length=t,this.revIndex=ko(t),this.coefs=Lo(t),this.copy=new Bt(4,t),this.out=new Bt(4,t),this.window=new Float32Array(t),this.window.fill(1)}revIndex;coefs;copy;out;window;setWindow(t){this.window.set(t)}transform(t,e){let i=this.length,[s,o]=this.out.get(i);if(s.fill(0),o.fill(0),e===void 0)for(let n=0;n<i&&n<t.length;++n){let a=this.revIndex[n];s[a]=this.window[n]*t[n]/i}else for(let n=0;n<i&&n<t.length&&n<e.length;++n){let a=this.revIndex[n];s[a]=this.window[n]*t[n]/i,o[a]=this.window[n]*e[n]/i}return Sr(this.length,!1,this.coefs,s,o),[s,o]}transformCircularBuffers(t,e){let i=this.length,[s,o]=this.copy.get(i);return t.copyTo(s),e.copyTo(o),this.transform(s,o)}reverse(t,e){let i=this.length,[s,o]=this.out.get(i);s.fill(0),o.fill(0);for(let n=0;n<i&&n<t.length&&n<e.length;++n){let a=this.revIndex[n];s[a]=t[n],o[a]=e[n]}return Sr(this.length,!0,this.coefs,s,o),[s,o]}};function Sr(r,t,e,i,s){let o=t?-1:1;for(let n=0;n<r;n+=4){let a=n,l=n+1,c=n+2,d=n+3,p=i[a],v=i[l],f=i[c],S=i[d],A=s[a],Pt=s[l],Et=s[c],_t=s[d];i[a]=p+v+f+S,i[l]=p-v-o*(_t-Et),i[c]=p+v-f-S,i[d]=p-v+o*(_t-Et),s[a]=A+Pt+Et+_t,s[l]=A-Pt-o*(f-S),s[c]=A+Pt-Et-_t,s[d]=A-Pt+o*(f-S)}for(let n=8,a=0;n<=r;n*=2,++a){let l=e[a],c=n/2;for(let d=0;d<r;d+=n)for(let p=0;p<c;p+=4){let v=l.real[p],f=l.imag[p]*o,S=l.real[p+1],A=l.imag[p+1]*o,Pt=l.real[p+2],Et=l.imag[p+2]*o,_t=l.real[p+3],Rs=l.imag[p+3]*o,re=d+p,Ae=re+c,qs=i[re],Ts=i[Ae],Bs=s[re],Os=s[Ae],Is=v*Ts-f*Os,Ns=v*Os+f*Ts;i[re]=qs+Is,i[Ae]=qs-Is,s[re]=Bs+Ns,s[Ae]=Bs-Ns;let oe=d+p+1,ze=oe+c,Ls=i[oe],ks=i[ze],Hs=s[oe],js=s[ze],Us=S*ks-A*js,Ws=S*js+A*ks;i[oe]=Ls+Us,i[ze]=Ls-Us,s[oe]=Hs+Ws,s[ze]=Hs-Ws;let ne=d+p+2,Fe=ne+c,Zs=i[ne],Vs=i[Fe],Qs=s[ne],Ys=s[Fe],Gs=Pt*Vs-Et*Ys,Xs=Pt*Ys+Et*Vs;i[ne]=Zs+Gs,i[Fe]=Zs-Gs,s[ne]=Qs+Xs,s[Fe]=Qs-Xs;let ae=d+p+3,Re=ae+c,Ks=i[ae],Js=i[Re],tr=s[ae],er=s[Re],ir=_t*Js-Rs*er,sr=_t*er+Rs*Js;i[ae]=Ks+ir,i[Re]=Ks-ir,s[ae]=tr+sr,s[Re]=tr-sr}}}function Lo(r){let t=$r(r),e=[];for(let i=0,s=4;i<t;++i,s*=2){e.push({real:new Float32Array(s),imag:new Float32Array(s)});for(let o=0;o<s;++o){let n=-1*Math.PI*o/s;e[i].real[o]=Math.cos(n),e[i].imag[o]=Math.sin(n)}}return e}function ko(r){let t=$r(r),e=new Int32Array(r);for(let i=0;i<r;++i)e[i]=Ho(i,t);return e}function $r(r){let t=0;for(let e=r-1;e>0;e>>=1)++t;return t}function Ho(r,t){let e=0;for(let i=0;i<t;++i)e<<=1,e|=r&1,r>>=1;return e}function ke(r,t){if(t==0&&r==0)return 0;let e=Math.abs(t)<Math.abs(r),i=e?t/r:r/t,s=i*i,o=i*(.9999993329+s*(-.3332985605+s*(.1994653599+s*(-.1390853351+s*(.0964200441+s*(-.0559098861+s*(.0218612288+s*-.004054058)))))));return e&&(i>=0?o=Math.PI/2-o:o=-Math.PI/2-o),t>=0?o:r>=0?o+Math.PI:o-Math.PI}var N=class r{coefs;constructor(t){this.coefs=t,this.offset=this.coefs.length-1,this.center=Math.floor(this.coefs.length/2),this.pool=new F(2,2*this.offset),this.curSamples=this.pool.get(this.offset)}offset;center;pool;curSamples;setCoefficients(t){let e=this.curSamples;this.coefs=t,this.offset=this.coefs.length-1,this.center=Math.floor(this.coefs.length/2),this.curSamples=this.pool.get(this.offset),this.loadSamples(e)}clone(){return new r(this.coefs)}getDelay(){return this.center}inPlace(t){this.loadSamples(t);for(let e=0;e<t.length;++e)t[e]=this.get(e)}loadSamples(t){let e=t.length+this.offset;if(this.curSamples.length!=e){let i=this.pool.get(e);i.set(this.curSamples.subarray(this.curSamples.length-this.offset)),this.curSamples=i}else this.curSamples.copyWithin(0,t.length);this.curSamples.set(t,this.offset)}get(t){let e=0,i=0,s=this.coefs.length,o=4*Math.floor(s/4);for(;e<o;)i+=this.coefs[e++]*this.curSamples[t++]+this.coefs[e++]*this.curSamples[t++]+this.coefs[e++]*this.curSamples[t++]+this.coefs[e++]*this.curSamples[t++];let n=2*Math.floor(s/2);for(;e<n;)i+=this.coefs[e++]*this.curSamples[t++]+this.coefs[e++]*this.curSamples[t++];for(;e<s;)i+=this.coefs[e++]*this.curSamples[t++];return i}},Q=class r{constructor(t){this.fft=ge.ofLength(t.length*2),this.kernel=this.computeKernel(t),this.overlap=t.length-1,this.input=new Ot(this.fft.length),this.input.fill(0,this.overlap),this.work=new Float32Array(this.fft.length),this.output=new Ot((this.fft.length-this.overlap)*2),this.output.fill(0,this.fft.length-this.overlap)}fft;kernel;overlap;input;work;output;computeKernel(t){let e=new Float32Array(this.fft.length),i=new Float32Array(this.fft.length);e.set(t),e.subarray(0,t.length).reverse();for(let o=0;o<e.length;++o)e[o]*=e.length;let s=this.fft.transform(e,i);return[new Float32Array(s[0]),new Float32Array(s[1])]}setCoefficients(t){let e=Bi(t.length*2),i=t.length-1;if(this.kernel=this.computeKernel(t),e==this.fft.length&&i==this.overlap)return;this.fft=ge.ofLength(e),this.overlap=i;let s=new Float32Array(this.input.available);this.input.moveTo(s),this.input=new Ot(this.fft.length),i>s.length&&this.input.fill(0,i-s.length),this.input.store(s),this.work=new Float32Array(this.fft.length),this.output=new Ot((this.fft.length-this.overlap)*2),this.output.fill(0,this.fft.length-this.overlap)}clone(){let t=new r(new Float32Array(this.overlap+1));return t.kernel=this.kernel,t}getDelay(){return this.fft.length-this.overlap/2}inPlace(t){let e=0,i=0;for(;t.length-e>0;){if(this.input.available<this.input.capacity){let s=Math.min(t.length-e,this.input.capacity-this.input.available);this.input.store(t.subarray(e,e+s)),e+=s}if(this.input.available==this.input.capacity){this.input.copyTo(this.work),this.input.consume(this.input.capacity-this.overlap);let s=this.fft.transform(this.work);for(let n=0;n<s[0].length;++n){let a=s[0][n],l=s[1][n],c=this.kernel[0][n],d=this.kernel[1][n];s[0][n]=a*c-l*d,s[1][n]=l*c+a*d}let o=this.fft.reverse(s[0],s[1]);this.output.store(o[0].subarray(this.overlap))}if(i<t.length){let s=this.output.moveTo(t.subarray(i,e));i+=s}}}},lt=class r{constructor(t){this.filterI=t.clone(),this.filterQ=t.clone()}filterI;filterQ;setCoefficients(t){this.filterI.setCoefficients(t),this.filterQ.setCoefficients(t)}clone(){return new r(this.filterI)}getDelay(){return this.filterI.getDelay()}inPlace(t,e){this.filterI.inPlace(t),this.filterQ.inPlace(e)}},He=class r{constructor(t){this.buffer=new Float32Array(t),this.ptr=0}buffer;ptr;clone(){return new r(this.getDelay())}getDelay(){return this.buffer.length}inPlace(t){for(let e=0;e<t.length;++e){let i=t[e];t[e]=this.buffer[this.ptr],this.buffer[this.ptr]=i,this.ptr=(this.ptr+1)%this.buffer.length}}},Ut=class r{sampleRate;constructor(t,e,i){this.sampleRate=t,this.dcBlocker=new Oi(t),this.alpha=ye(t,e),this.counter=0,this.maxPower=0,this.maxGain=i||100}dcBlocker;alpha;counter;maxPower;maxGain;clone(){let t=new r(this.sampleRate,1,this.maxGain);return t.alpha=this.alpha,t}getDelay(){return 0}inPlace(t){let e=this.alpha,i=this.maxPower,s=this.counter,o;this.dcBlocker.inPlace(t);for(let n=0;n<t.length;++n){let a=t[n],l=a*a;l>.9*i?(s=this.sampleRate,l>i&&(i=l)):s>0?--s:i-=e*i,o=Math.min(this.maxGain,1/Math.sqrt(i)),t[n]*=o}this.maxPower=i,this.counter=s}},Oi=class r{constructor(t){this.alpha=ye(t,.5),this.dc=0}alpha;dc;clone(){let t=new r(1e3);return t.alpha=this.alpha,t.dc=this.dc,t}getDelay(){return 0}inPlace(t){let e=this.alpha,i=this.dc;for(let s=0;s<t.length;++s)i+=e*(t[s]-i),t[s]-=i;this.dc=i}};function ye(r,t){return 1-Math.exp(-1/(r*t))}var Ii=class r{sampleRate;constructor(t,e,i,s){this.sampleRate=t,this.q=[e,i,s],this.v=[0,0]}q;v;clone(){return new r(this.sampleRate,...this.q)}getDelay(){return 0}inPlace(t){let e=this.q,i=this.v[0],s=this.v[1];for(let o=0;o<t.length;++o){let n=t[o];t[o]=s=e[0]*n+e[1]*i+e[2]*s,i=n}this.v[0]=i,this.v[1]=s}},Ni=class r{sampleRate;constructor(t,e,i,s,o,n){this.sampleRate=t,this.q=[e,i,s,o,n],this.v=[0,0,0,0]}q;v;clone(){return new r(this.sampleRate,...this.q)}getDelay(){return 0}inPlace(t){let e=this.q,i=this.v[0],s=this.v[1],o=this.v[2],n=this.v[3];for(let a=0;a<t.length;++a){let l=t[a],c=t[a]=e[0]*l+e[1]*i+e[2]*s+e[3]*o+e[4]*n;n=o,o=c,s=i,i=l}this.v[0]=i,this.v[1]=s,this.v[2]=o,this.v[3]=n}};function jo(r,t){let e=2*Math.PI*t/r,s=1/(2*r*Math.tan(e/2)),o=1+2*s*r,n=1-2*s*r;return[1/o,1/o,-n/o]}function Uo(r,t,e){let i=2*Math.PI*t/r,s=Math.sin(i)/(2*e),o=(1-Math.cos(i))/2,n=1-Math.cos(i),a=(1-Math.cos(i))/2,l=1+s,c=-2*Math.cos(i),d=1-s;return[o/l,n/l,a/l,-c/l,-d/l]}var be=class extends Ii{constructor(t,e){super(t,...jo(t,1/(2*Math.PI*e)))}};var Li=class extends Ni{constructor(t,e,i){super(t,...Uo(t,e,i))}},j=class{sampleRate;constructor(t){this.sampleRate=t,this.cosine=1,this.sine=0}cosine;sine;inPlace(t,e,i){let s=this.cosine,o=this.sine,n=Math.cos(2*Math.PI*i/this.sampleRate),a=Math.sin(2*Math.PI*i/this.sampleRate);for(let l=0;l<t.length;++l){let c=t[l]*s-e[l]*o;e[l]=t[l]*o+e[l]*s,t[l]=c;let d=s*a+o*n;s=s*n-o*a,o=d}this.cosine=s,this.sine=o}},je=class{sampleRate;targetFreq;constructor(t,e,i){this.sampleRate=t,this.targetFreq=e,this.iqPool=new Bt(2),this.downShifter=new j(t),this.upShifter=new j(t),this.filterI=new Li(t,i*100,1),this.filterQ=this.filterI.clone(),this.prev=[1,0],this.tolerance=2*Math.PI*i/t,this.speedEstimate=0,this.speedDecay=ye(t,.25),this.isLocked=!1}iqPool;downShifter;upShifter;filterI;filterQ;prev;tolerance;speedEstimate;speedDecay;isLocked;get locked(){return this.isLocked}extract(t){let e=this.speedDecay,i=this.prev[0],s=this.prev[1],o=this.speedEstimate,n=this.iqPool.get(t.length),a=n[0],l=n[1];a.set(t),l.fill(0),this.downShifter.inPlace(a,l,-this.targetFreq),this.filterI.inPlace(a),this.filterQ.inPlace(l);for(let c=0;c<a.length;++c){let d=Math.hypot(a[c],l[c]);d>0?(a[c]/=d,l[c]/=d,o+=e*(ke(l[c]*i-a[c]*s,a[c]*i+l[c]*s)-o)):o+=e*(2*this.tolerance-o),i=a[c],s=l[c]}return this.upShifter.inPlace(a,l,this.targetFreq),this.prev[0]=i,this.prev[1]=s,this.speedEstimate=o,this.isLocked=o>=-this.tolerance&&o<=this.tolerance,n}};var mt;(function(r){r[r.Upper=0]="Upper",r[r.Lower=1]="Lower"})(mt||(mt={}));var Ue=class{constructor(t,e,i){let s=xr(e);this.filterHilbert=i?.useFftFilter?new Q(s):new N(s),this.filterDelay=new He(this.filterHilbert.getDelay()),this.hilbertMul=t==mt.Upper?-1:1}filterHilbert;filterDelay;hilbertMul;setSideband(t){this.hilbertMul=t==mt.Upper?-1:1}demodulate(t,e,i){this.filterDelay.inPlace(t),this.filterHilbert.inPlace(e);for(let s=0;s<i.length;++s)i[s]=(t[s]+e[s]*this.hilbertMul)/2}},We=class{constructor(t){this.alpha=ye(t,.5),this.carrierAmplitude=0}alpha;carrierAmplitude;demodulate(t,e,i){let s=this.alpha,o=this.carrierAmplitude;for(let n=0;n<i.length;++n){let a=t[n],l=e[n],c=a*a+l*l,d=Math.sqrt(c);o+=s*(d-o),i[n]=o==0?0:d/o-1}this.carrierAmplitude=o}},Wt=class{constructor(t){this.mul=1/(2*Math.PI*t),this.lI=0,this.lQ=0}mul;lI;lQ;setMaxDeviation(t){this.mul=1/(2*Math.PI*t)}demodulate(t,e,i){let s=this.mul,o=this.lI,n=this.lQ;for(let a=0;a<t.length;++a){let l=o*t[a]+n*e[a],c=o*e[a]-t[a]*n;o=t[a],n=e[a],i[a]=ke(c,l)*s}this.lI=o,this.lQ=n}},Ze=class{constructor(t,e){this.pool=new F(4),this.detector=new je(t,e,2)}pool;detector;separate(t){let e=this.pool.get(t.length),i=this.detector.extract(t),s=i[0],o=i[1];for(let n=0;n<t.length;++n)e[n]=t[n]*s[n]*o[n]*4;return{found:this.detector.locked,diff:e}}};function U(r,t){let e=0;for(let i=0;i<r.length;++i){let s=r[i],o=t[i];e+=s*s+o*o}return e/r.length}var ki=class{ratio;constructor(t,e){this.ratio=t,this.filter=e.clone(),this.pool=new F(2)}filter;pool;downsample(t){let e=this.ratio,i=Math.floor(t.length/e),s=this.pool.get(i);this.filter.loadSamples(t);for(let o=0;o<i;++o)s[o]=this.filter.get(Math.floor(o*e));return s}getDelay(){return this.filter.getDelay()}};function Hi(r,t,e){let i=r/t,s=e;return typeof s=="number"&&(s=O(r,t/2,s)),new ki(i,new N(s))}var ve=class{constructor(t,e,i){this.downsampler=Hi(t,e,i)}downsampler;downsample(t){return this.downsampler.downsample(t)}getDelay(){return this.downsampler.getDelay()}},J=class{constructor(t,e,i){this.downsamplerI=Hi(t,e,i),this.downsamplerQ=Hi(t,e,i)}downsamplerI;downsamplerQ;downsample(t,e){return[this.downsamplerI.downsample(t),this.downsamplerQ.downsample(e)]}getDelay(){return this.downsamplerI.getDelay()}};var Ve=class{outRate;mode;constructor(t,e,i,s){this.outRate=e,this.mode=i;let o=s?.downsamplerTaps||151;this.rfTaps=s?.rfTaps||151,this.shifter=new j(t),this.downsampler=new J(t,e,o);let n=O(e,this.mode.bandwidth/2,this.rfTaps);this.filter=new lt(s?.useFftFilter?new Q(n):new N(n)),this.demodulator=new We(e),this.outPool=new F(1)}rfTaps;shifter;downsampler;filter;demodulator;outPool;getMode(){return this.mode}setMode(t){this.mode=t;let e=O(this.outRate,t.bandwidth/2,this.rfTaps);this.filter.setCoefficients(e)}demodulate(t,e,i){this.shifter.inPlace(t,e,-i);let[s,o]=this.downsampler.downsample(t,e),n=U(s,o);this.filter.inPlace(s,o);let a=U(s,o)*this.outRate/this.mode.bandwidth;this.demodulator.demodulate(s,o,s);let l=this.outPool.get(s.length);return l.set(s),{left:s,right:l,stereo:!1,snr:a/n}}},Qe=class extends K{constructor(t){super(t)}create(){return{scheme:"AM",bandwidth:15e3,squelch:0}}hasBandwidth(){return!0}getBandwidth(){return this.mode.bandwidth}setBandwidth(t){return this.mode={...this.mode,bandwidth:Math.max(250,Math.min(t,3e4))},this}hasSquelch(){return!0}getSquelch(){return this.mode.squelch}setSquelch(t){return this.mode={...this.mode,squelch:Math.max(0,Math.min(t,6))},this}};var Ye=class{outRate;mode;constructor(t,e,i,s){this.outRate=e,this.mode=i;let o=s?.downsamplerTaps||151;this.audioTaps=s?.audioTaps||351;let n=s?.toneFrequency||600;this.shifter=new j(t),this.downsampler=new J(t,e,o);let a=O(e,i.bandwidth/2,this.audioTaps);this.filter=new lt(s?.useFftFilter?new Q(a):new N(a)),this.toneShifter=new j(e),this.toneFrequency=n,this.agc=new Ut(e,10),this.outPool=new F(1)}audioTaps;shifter;downsampler;filter;toneShifter;toneFrequency;agc;outPool;getMode(){return this.mode}setMode(t){this.mode=t;let e=O(this.outRate,t.bandwidth/2,this.audioTaps);this.filter.setCoefficients(e)}demodulate(t,e,i){this.shifter.inPlace(t,e,-i);let[s,o]=this.downsampler.downsample(t,e),n=U(s,o);this.filter.inPlace(s,o);let a=U(s,o)*this.outRate/this.mode.bandwidth;this.toneShifter.inPlace(s,o,this.toneFrequency),this.agc.inPlace(s);let l=this.outPool.get(s.length);return l.set(s),{left:s,right:l,stereo:!1,snr:a/n}}},Ge=class extends K{constructor(t){super(t)}create(){return{scheme:"CW",bandwidth:50}}hasBandwidth(){return!0}getBandwidth(){return this.mode.bandwidth}setBandwidth(t){return this.mode={...this.mode,bandwidth:Math.max(5,Math.min(t,1e3))},this}};var Xe=class{outRate;mode;constructor(t,e,i,s){this.outRate=e,this.mode=i;let o=s?.downsamplerTaps||151;this.rfTaps=s?.rfTaps||151,this.shifter=new j(t),this.downsampler=new J(t,e,o);let n=O(e,i.maxF,this.rfTaps);this.filter=new lt(s?.useFftFilter?new Q(n):new N(n)),this.demodulator=new Wt(i.maxF/e),this.outPool=new F(1)}rfTaps;shifter;downsampler;filter;demodulator;outPool;getMode(){return this.mode}setMode(t){this.mode=t;let e=O(this.outRate,t.maxF,this.rfTaps);this.filter.setCoefficients(e),this.demodulator.setMaxDeviation(t.maxF/this.outRate)}demodulate(t,e,i){this.shifter.inPlace(t,e,-i);let[s,o]=this.downsampler.downsample(t,e),n=U(s,o);this.filter.inPlace(s,o);let a=U(s,o)*this.outRate/(this.mode.maxF*2);this.demodulator.demodulate(s,o,s);let l=this.outPool.get(s.length);return l.set(s),{left:s,right:l,stereo:!1,snr:a/n}}},Ke=class extends K{constructor(t){super(t)}create(){return{scheme:"NBFM",maxF:5e3,squelch:0}}hasBandwidth(){return!0}getBandwidth(){return 2*this.mode.maxF}setBandwidth(t){return this.mode={...this.mode,maxF:Math.max(125,Math.min(t/2,15e3))},this}hasSquelch(){return!0}getSquelch(){return this.mode.squelch}setSquelch(t){return this.mode={...this.mode,squelch:Math.max(0,Math.min(t,6))},this}};var we=class{outRate;mode;constructor(t,e,i,s){this.outRate=e,this.mode=i;let o=s?.downsamplerTaps||151;this.rfTaps=s?.rfTaps||151;let n=s?.hilbertTaps||151;this.shifter=new j(t),this.downsampler=new J(t,e,o);let a=O(this.outRate,i.bandwidth/2,this.rfTaps);this.filter=s?.useFftFilter?new Q(a):new N(a),this.demodulator=new Ue(i.scheme=="USB"?mt.Upper:mt.Lower,n,{useFftFilter:s?.useFftFilter}),this.agc=new Ut(e,3),this.outPool=new F(1)}rfTaps;shifter;downsampler;filter;demodulator;agc;outPool;getMode(){return this.mode}setMode(t){this.mode=t;let e=O(this.outRate,t.bandwidth/2,this.rfTaps);this.filter.setCoefficients(e),this.demodulator.setSideband(t.scheme=="USB"?mt.Upper:mt.Lower)}demodulate(t,e,i){this.shifter.inPlace(t,e,-i);let[s,o]=this.downsampler.downsample(t,e),n=U(s,o);this.demodulator.demodulate(s,o,s),this.filter.inPlace(s);let a=U(s,s)*this.outRate/(this.mode.bandwidth*2);this.agc.inPlace(s);let l=this.outPool.get(s.length);return l.set(s),{left:s,right:l,stereo:!1,snr:a/n}}},xe=class extends K{constructor(t){super(t)}create(t){return{scheme:t,bandwidth:2800,squelch:0}}hasBandwidth(){return!0}getBandwidth(){return this.mode.bandwidth}setBandwidth(t){return this.mode={...this.mode,bandwidth:Math.max(10,Math.min(t,15e3))},this}hasSquelch(){return!0}getSquelch(){return this.mode.squelch}setSquelch(t){return this.mode={...this.mode,squelch:Math.max(0,Math.min(t,6))},this}};var Je=class{mode;constructor(t,e,i,s){this.mode=i;let o=Math.min(t,336e3);this.stage1=new ji(t,o,i,s),this.stage2=new Ui(o,e,i,s)}stage1;stage2;getMode(){return this.mode}setMode(t){this.mode=t,this.stage1.setMode(t),this.stage2.setMode(t)}demodulate(t,e,i){let s=this.stage1.demodulate(t,e,i),o=this.stage2.demodulate(s.left);return o.snr=s.snr,o}},ji=class{outRate;mode;constructor(t,e,i,s){this.outRate=e,this.mode=i;let o=75e3,n=s?.downsamplerTaps||151,a=s?.rfTaps||151;this.shifter=new j(t),t!=e&&(this.downsampler=new J(t,e,n));let l=O(e,o,a);this.filter=new lt(s?.useFftFilter?new Q(l):new N(l)),this.demodulator=new Wt(o/e)}shifter;downsampler;filter;demodulator;getMode(){return this.mode}setMode(t){this.mode=t}demodulate(t,e,i){this.shifter.inPlace(t,e,-i);let[s,o]=this.downsampler?this.downsampler.downsample(t,e):[t,e],n=U(s,o);this.filter.inPlace(s,o);let a=U(s,o)*this.outRate/15e4;return this.demodulator.demodulate(s,o,s),{left:s,right:new Float32Array(s),stereo:!1,snr:a/n}}},Ui=class{mode;constructor(t,e,i,s){this.mode=i;let o=19e3,n=(s?.deemphasizerTc===void 0?50:s.deemphasizerTc)/1e6,a=s?.audioTaps||41,l=Math.min(15e3,e/2),c=O(t,l,a,1/.9);this.monoSampler=new ve(t,e,c),this.stereoSampler=new ve(t,e,c),this.stereoSeparator=new Ze(t,o),this.leftDeemph=new be(e,n),this.rightDeemph=new be(e,n),this.outPool=new F(2,1024)}monoSampler;stereoSampler;stereoSeparator;leftDeemph;rightDeemph;outPool;getMode(){return this.mode}setMode(t){this.mode=t}demodulate(t){let e=this.monoSampler.downsample(t);if(this.mode.stereo){let s=this.stereoSeparator.separate(t);if(s.found){let o=this.stereoSampler.downsample(s.diff),n=this.outPool.get(e.length),a=e;for(let l=0;l<o.length;++l)n[l]=e[l]-o[l],a[l]=e[l]+o[l];return this.leftDeemph.inPlace(n),this.rightDeemph.inPlace(a),{left:n,right:a,stereo:!0,snr:1}}}this.leftDeemph.inPlace(e);let i=this.outPool.get(e.length);return i.set(e),{left:e,right:i,stereo:!1,snr:1}}},ti=class extends K{constructor(t){super(t)}create(){return{scheme:"WBFM",stereo:!0}}hasStereo(){return!0}getStereo(){return this.mode.stereo}setStereo(t){return this.mode={...this.mode,stereo:t},this}getBandwidth(){return 15e4}};Tt("WBFM",Je,ti);Tt("NBFM",Xe,Ke);Tt("AM",Ve,Qe);Tt("USB",we,xe);Tt("LSB",we,xe);Tt("CW",Ye,Ge);function L(r,t){return u`<svg version="1.1" width="16" height="16">
    <title>${r}</title>
    ${t}
  </svg>`}var Dr=L("Close",z`<g><path d="M2 4v-2h2l4 4 4 -4h2v2l-4 4 4 4v2h-2l-4 -4 -4 4h-2v-2l4 -4z"></path></g>`),Cr=L("Resize",z`<g><path d="M2,2V8L4.25,5.75 10.25,11.75 8,14 14,14 14,8 11.75,10.25 5.75,4.25 8,2Z"></path></g>`),ei=L("Stop playing",z`<g><path d="M3 3v10h10V3z"></path></g>`),ii=L("Start playing",z`<g><path d="M3 2v12l10 -6z"></path></g>`),si=L("Settings",z`<g><path d="M5 1A4 4 0 0 0 3.7 1.2L6.5 4 6 6 4 6.5 1.2 3.7A4 4 0 0 0 1 5 4 4 0 0 0 5 9 4 4 0 0 0 6.6 8.6L12.5 14.5A1.4 1.4 0 0 0 13.6 15 1.4 1.4 0 0 0 15 13.6 1.4 1.4 0 0 0 14.5 12.5L8.6 6.6A4 4 0 0 0 9 5 4 4 0 0 0 5 1z"></path></g>`),Mr=L("Help",z`<g>
    <path
      d="M8 1A5 4.5 0 0 0 3 5.5L3 6L5 6L5 5.5A3 2.5 0 0 1 8 3A3 2.5 0 0 1 11 5.5A3 2.5 0 0 1 8 8L7 8L7 9L7 10L7 12L9 12L9 10A5 4.5 0 0 0 13 5.5A5 4.5 0 0 0 8 1z"
    ></path>
    <circle cy="14" cx="8" r="1"></circle>
  </g>`),ri=L("Scroll left",z`<g><path d="m11 2v2l-4 4 4 4v2H9L3 8 9 2Z"></path></g>`),oi=L("Scroll right",z`<g><path d="m5 2v2l4 4 -4 4v2h2L13 8 7 2Z"></path></g>`);function Pr(r,t){return L(r,z`<g>
        <path
          d="M7 1A6 6 0 0 0 1 7A6 6 0 0 0 7 13A6 6 0 0 0 13 7A6 6 0 0 0 7 1zM7 3A4 4 0 0 1 11 7A4 4 0 0 1 7 11A4 4 0 0 1 3 7A4 4 0 0 1 7 3z"
        ></path>
        <path d="M14.5 13l-1.5 1.5 -4 -4 1.5 -1.5z"></path>
        ${t}
      </g>`)}var ni=Pr("Zoom in",z`<path d="M4 6v2h2v2h2v-2h2v-2h-2v-2h-2v2Z"></path>`),ai=Pr("Zoom out",z`<path d="M4 6v2h6v-2Z"></path>`),Er=L("Stereo",z`<g><path d="M6 3A5 5 0 0 0 1 8A5 5 0 0 0 6 13A5 5 0 0 0 8 13A5 5 0 0 0 10 13A5 5 0 0 0 15 8A5 5 0 0 0 10 3A5 5 0 0 0 8 3A5 5 0 0 0 6 3zM6 5A3 3 0 0 1 9 8A3 3 0 0 1 6 11A3 3 0 0 1 3 8A3 3 0 0 1 6 5zM10 5A3 3 0 0 1 13 8A3 3 0 0 1 10 11A3 3 0 0 1 10 11A5 5 0 0 0 11 8A5 5 0 0 0 10 5z"></g>`),_r=L("Reload",z`<g>
    <path d="M8 1A7 7 0 0 0 1 8A7 7 0 0 0 15 8h-2A5 5 0 0 1 3 8A5 5 0 0 1 12 5h-3v2h6v-6h-2v2A7 7 0 0 0 8 1z"></path>
  </g>`),Se=L("Add",z`<g><path d="M2,7h5v-5h2v5h5v2h-5v5h-2v-5h-5z"></path></g>`),li=L("Edit",z`<g><path d="M1.9,15.37A1,1 0 0 1 0.63,14.1L2,10 12,0 16,4 6,14ZM2,14 5,13 3,11ZM6,12 14,4 12,2 4,10Z"></path></g>`),hi=L("Delete",z`<g><path d="M2 2h1l5 5 5 -5h1v1l-5 5 5 5v1h-1l-5 -5 -5 5h-1v-1l5 -5l-5 -5z"></path></g>`),gl=L("Update",z`<g><path d="M1 1L3 3A7 7 0 0 0 1 8A7 7 0 0 0 8 15v-2A5 5 0 0 1 3 8A5 5 0 0 1 4.5 4.5L7 7v-6h-6zM8 1v2A5 5 0 0 1 13 8A5 5 0 0 1 11.5 11.5L9 9v6h6L13 13A7 7 0 0 0 15 8A7 7 0 0 0 8 1z"></path></g>`),ci=L("Presets",z`<g><path d="M1,1h6v6h-6zM3,3v2h2v-2zM9,1h6v6h-6zM11,3v2h2v-2zM1,9h6v6h-6zM3,11v2h2v-2zM9,9h6v6h-6zM11,11v2h2v-2z"></path></g>`),Ar=u`<svg version="1.1" width="10" height="9">
  <g><path d="M1,8h8l-4,-6z"></path></g>
</svg>`,zr=u`<svg version="1.1" width="10" height="9">
  <g><path d="M1,1h8l-4,6z"></path></g>
</svg>`;var Vt=class extends CustomEvent{constructor(t){super("spectrum-tap",{detail:t,bubbles:!0,composed:!0})}},It=class extends CustomEvent{constructor(t){super("spectrum-drag",{detail:t,bubbles:!0,composed:!0})}},di=class extends CustomEvent{constructor(t){super("spectrum-highlight-changed",{detail:t,bubbles:!0,composed:!0})}},Nt=class extends CustomEvent{constructor(t){super("spectrum-zoom",{detail:t,bubbles:!0,composed:!0})}},$e=class extends CustomEvent{constructor(t){super("spectrum-decibel-range-changed",{detail:t,bubbles:!0,composed:!0})}};var Y=class{constructor(t,e,i,s,o){this.width=e;this.bins=i;this.centerFreq=s;this.bandwidth=o;this.leftBin=Math.floor(t.leftFraction*i),this.visibleBins=Math.floor(t.spanFraction*i),this.leftFrequency=this.binNumberToFrequency(this.leftBin-.5),this.rightFrequency=this.binNumberToFrequency(this.leftBin+this.visibleBins-.5)}zoomed(t){return(t*this.bins-this.leftBin+.5)/this.visibleBins}unzoomed(t){return(this.leftBin+this.visibleBins*t-.5)/this.bins}screenBinToFftBin(t){return(t+this.bins/2)%this.bins}leftCoordToBinNumber(t){return Math.round(this.leftBin+t*this.visibleBins/this.width)}binNumberToCenterCoord(t){return this.width*(t+.5-this.leftBin)/this.visibleBins}binNumberToFrequency(t){return this.centerFreq&&this.bandwidth?this.centerFreq+this.bandwidth*(t/this.bins-.5):this.centerFreq||0}};var Fr=1,Rr=16,x=class r{constructor(t,e){t===void 0&&(t=1),e===void 0&&(e=.5),t<Fr&&(t=Fr),t>Rr&&(t=Rr);let i=1/(2*t);e-i<0&&(e=i),e+i>1&&(e=1-i),this.center=e,this.level=t}zoomed(t){return .5+this.level*(t-this.center)}unzoomed(t){return this.center+(t-.5)/this.level}get leftFraction(){return this.center-1/(2*this.level)}get rightFraction(){return this.center+1/(2*this.level)}get spanFraction(){return 1/this.level}isVisible(t){let e=this.zoomed(t);return 0<=e&&e<1}withCenter(t){return new r(this.level,t)}withMovedCenter(t){return this.withCenter(this.center+t)}withLevel(t){return new r(t,this.center)}withLevelInContext(t,e){let i=this.zoomed(e);if(i<0||i>=1)return this.withLevel(t);let s=e+(.5-i)/t;return new r(t,s)}},I=new x;var Qt=function(r,t,e,i){var s=arguments.length,o=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(n=r[a])&&(o=(s<3?n(o):s>3?n(t,e,o):n(t,e))||o);return s>3&&o&&Object.defineProperty(t,e,o),o},Yt=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},qr,Tr,ht=class extends g{static get styles(){return[b`
        #scope {
          color: var(--rr-scope-color, yellow);
          width: 100%;
          height: 100%;
        }
      `]}render(){return u`<canvas id="scope"></canvas>`}constructor(){super(),this.minDecibels=-100,this.maxDecibels=-30,this.fftSize=2048,this.zoom=I,this.spectrum=new Float32Array(this.fftSize),this.width=this.fftSize,this.addEventListener("click",t=>this.onClick(t))}addFloatSpectrum(t){this.fftSize!=t.length&&(this.fftSize=t.length,this.spectrum=new Float32Array(this.fftSize)),this.spectrum.set(t),this.redraw()}updated(t){super.updated(t),t.has("zoom")&&this.redraw()}redraw(){let t=this.getContext();if(!t)return;let e=t.canvas.offsetWidth,i=t.canvas.offsetHeight;t.canvas.width!=e&&(t.canvas.width=e),t.canvas.height!=i&&(t.canvas.height=i),this.width!=e&&(this.width=e);let s=this.minDecibels,o=this.maxDecibels,n=o-s,a=(1-i)/n;t.clearRect(0,0,t.canvas.width,t.canvas.height),t.strokeStyle=getComputedStyle(this.canvas).getPropertyValue("color"),t.beginPath();let l=new Y(this.zoom,this.width,this.fftSize),c=d=>(this.spectrum[l.screenBinToFftBin(d)]-o)*a;if(l.visibleBins<=e){let d=p=>l.binNumberToCenterCoord(p);t.moveTo(d(l.leftBin-1),c(l.leftBin-1));for(let p=0;p<l.visibleBins+1;++p)t.lineTo(d(l.leftBin+p),c(l.leftBin+p))}else for(let d=0;d<e;++d){let p=l.leftCoordToBinNumber(d),v=l.leftCoordToBinNumber(d+1),f=c(p);for(let S=p+1;S<v;++S)f=Math.min(f,c(S));d==0?t.moveTo(d,f):t.lineTo(d,f)}t.stroke()}onClick(t){let i=new Y(this.zoom,this.width,this.fftSize).unzoomed(t.offsetX/this.offsetWidth);this.dispatchEvent(new Vt({fraction:i,target:"scope"})),t.preventDefault()}getContext(){if(this.context)return this.context;if(this.canvas)return this.canvas.width=this.fftSize,this.canvas.height=this.maxDecibels-this.minDecibels,this.context=this.canvas.getContext("2d"),this.context}};Qt([h({type:Number,reflect:!0,attribute:"min-decibels"}),Yt("design:type",Number)],ht.prototype,"minDecibels",void 0);Qt([h({type:Number,reflect:!0,attribute:"max-decibels"}),Yt("design:type",Number)],ht.prototype,"maxDecibels",void 0);Qt([h({type:Number,reflect:!0}),Yt("design:type",Number)],ht.prototype,"fftSize",void 0);Qt([h({attribute:!1}),Yt("design:type",typeof(qr=typeof x<"u"&&x)=="function"?qr:Object)],ht.prototype,"zoom",void 0);Qt([w("#scope"),Yt("design:type",typeof(Tr=typeof HTMLCanvasElement<"u"&&HTMLCanvasElement)=="function"?Tr:Object)],ht.prototype,"canvas",void 0);ht=Qt([y("rr-scope-line"),Yt("design:paramtypes",[])],ht);var gt=function(r,t,e,i){var s=arguments.length,o=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(n=r[a])&&(o=(s<3?n(o):s>3?n(t,e,o):n(t,e))||o);return s>3&&o&&Object.defineProperty(t,e,o),o},bt=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},Br,Or,ct=class extends g{static get styles(){return[b`
        canvas {
          color: var(--rr-captions-color, rgba(255, 255, 255, 0.5));
          width: 100%;
          height: 100%;
        }
      `]}render(){return u`<canvas id="canvas"></canvas>`}constructor(){super(),this.centerFrequency=0,this.frequencyScale=1,this.minDecibels=-100,this.maxDecibels=-30,this.fftSize=2048,this.zoom=I,this.resizeObserver=new ResizeObserver(()=>this.redraw())}connectedCallback(){super.connectedCallback(),this.resizeObserver?.disconnect(),this.resizeObserver.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.resizeObserver?.disconnect()}firstUpdated(t){super.firstUpdated(t),this.redraw()}updated(t){super.updated(t),!(t.size==0||t.size==1&&t.has("lines"))&&this.redraw()}redraw(){let t=this.getContext();if(!t)return;let e=t.canvas;e.width!=e.offsetWidth&&(e.width=this.offsetWidth),e.height!=e.offsetHeight&&(e.height=this.offsetHeight);let i=e.width,s=e.height,o=16,n=24,a=getComputedStyle(t.canvas).getPropertyValue("color"),l=this.computeLines(i-n,s-o);t.clearRect(0,0,i,s),t.save(),t.fillStyle=a;for(let{position:c,value:d,horizontal:p}of l){let[v,f]=[n+c*(i-n),o+c*(s-o)],S=String(p?d:d/(this.frequencyScale||1));if(p){t.textBaseline="middle",t.textAlign="right",v=n-2;let A=t.measureText(S);f-A.actualBoundingBoxAscent<o&&(f=A.actualBoundingBoxAscent+o),f+A.actualBoundingBoxDescent>s&&(f=s-A.actualBoundingBoxDescent)}else{t.textBaseline="bottom",t.textAlign="center",f=o-2;let A=t.measureText(S);v-A.actualBoundingBoxLeft<n&&(v=A.actualBoundingBoxLeft+n),v+A.actualBoundingBoxRight>i&&(v=i-A.actualBoundingBoxRight)}t.fillText(S,v,f)}t.restore(),t.save(),t.strokeStyle=a,t.beginPath();for(let{position:c,horizontal:d}of l)if(d){let p=o+c*(s-o);t.moveTo(n,p),t.lineTo(i,p)}else{let p=n+c*(i-n);t.moveTo(p,o),t.lineTo(p,s)}t.stroke(),t.restore()}getContext(){if(this.context)return this.context;if(this.canvas)return this.context=this.canvas.getContext("2d"),this.context}computeLines(t,e){let i=[];if(this.minDecibels!==void 0&&this.maxDecibels!==void 0&&i.push(...Ir(this.minDecibels,this.maxDecibels,20,25,e,De.Descending,Ce.Horizontal,[1,2,3,5,6,10])),this.bandwidth!==void 0){let s=new Y(this.zoom,1,this.fftSize,this.centerFrequency,this.bandwidth);i.push(...Ir(s.leftFrequency,s.rightFrequency,50,80,t,De.Ascending,Ce.Vertical))}else{let s=this.zoom.zoomed(.5);s>=0&&s<=1&&i.push({value:this.centerFrequency,position:s,horizontal:!1})}return i}};gt([h({type:Number,reflect:!0}),bt("design:type",Number)],ct.prototype,"bandwidth",void 0);gt([h({type:Number,reflect:!0,attribute:"center-frequency"}),bt("design:type",Number)],ct.prototype,"centerFrequency",void 0);gt([h({type:Number,reflect:!0,attribute:"frequency-scale"}),bt("design:type",Number)],ct.prototype,"frequencyScale",void 0);gt([h({type:Number,reflect:!0,attribute:"min-decibels"}),bt("design:type",Number)],ct.prototype,"minDecibels",void 0);gt([h({type:Number,reflect:!0,attribute:"max-decibels"}),bt("design:type",Number)],ct.prototype,"maxDecibels",void 0);gt([h({type:Number,reflect:!0}),bt("design:type",Number)],ct.prototype,"fftSize",void 0);gt([h({attribute:!1}),bt("design:type",typeof(Br=typeof x<"u"&&x)=="function"?Br:Object)],ct.prototype,"zoom",void 0);gt([w("#canvas"),bt("design:type",typeof(Or=typeof HTMLCanvasElement<"u"&&HTMLCanvasElement)=="function"?Or:Object)],ct.prototype,"canvas",void 0);ct=gt([y("rr-scope-background"),bt("design:paramtypes",[])],ct);var De;(function(r){r[r.Ascending=0]="Ascending",r[r.Descending=1]="Descending"})(De||(De={}));var Ce;(function(r){r[r.Horizontal=0]="Horizontal",r[r.Vertical=1]="Vertical"})(Ce||(Ce={}));function Ir(r,t,e,i,s,o,n,a=[1,2,5,10]){let l=t-r,c=Math.pow(10,Math.floor(Math.log10(l/2))),d=Wi(e/s,i/s,l,c,a),p=n==Ce.Horizontal,v=[],f=r;for(f%d!=0&&(f+=d-f%d);f<=t;){let S=o==De.Ascending?(f-r)/l:(t-f)/l;v.push({position:S,value:f,horizontal:p}),f+=d}return v}function Wi(r,t,e,i,s){let o=e*r/i,n=e*t/i,a=(o+n)/2;if(n<s[0])return Wi(r,t,e,i/10,s);if(o>s[s.length-1])return Wi(r,t,e,i*10,s);let l=s[0],c=Math.abs(l-a),d=l>=o&&l<=n;for(let p=1;p<s.length;++p){let v=s[p]>=o&&s[p]<=n;if(d&&!v)continue;let f=Math.abs(s[p]-a);f<c&&(l=s[p],c=f,d=v)}return l*i}var yt=function(r,t,e,i){var s=arguments.length,o=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(n=r[a])&&(o=(s<3?n(o):s>3?n(t,e,o):n(t,e))||o);return s>3&&o&&Object.defineProperty(t,e,o),o},Dt=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},Nr,Lr,k=class extends g{constructor(){super(...arguments),this.centerFrequency=0,this.frequencyScale=1,this.minDecibels=-100,this.maxDecibels=-30,this.fftSize=2048,this.zoom=I}static get styles(){return[b`
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
      `]}render(){return u`<div id="container">
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
    </div> `}addFloatSpectrum(t){t.length!=this.fftSize&&(this.fftSize=t.length),this.line?.addFloatSpectrum(t)}};yt([h({type:Number,reflect:!0}),Dt("design:type",Number)],k.prototype,"bandwidth",void 0);yt([h({type:Number,reflect:!0,attribute:"center-frequency"}),Dt("design:type",Number)],k.prototype,"centerFrequency",void 0);yt([h({type:Number,reflect:!0,attribute:"frequency-scale"}),Dt("design:type",Number)],k.prototype,"frequencyScale",void 0);yt([h({type:Number,reflect:!0,attribute:"min-decibels"}),Dt("design:type",Number)],k.prototype,"minDecibels",void 0);yt([h({type:Number,reflect:!0,attribute:"max-decibels"}),Dt("design:type",Number)],k.prototype,"maxDecibels",void 0);yt([h({type:Number,reflect:!0}),Dt("design:type",Number)],k.prototype,"fftSize",void 0);yt([h({attribute:!1}),Dt("design:type",typeof(Nr=typeof x<"u"&&x)=="function"?Nr:Object)],k.prototype,"zoom",void 0);yt([w("#line"),Dt("design:type",typeof(Lr=typeof ht<"u"&&ht)=="function"?Lr:Object)],k.prototype,"line",void 0);k=yt([y("rr-scope")],k);function Wo(r,t,e,i){let s=new Array(256),o=s.length;for(let n=0;n<o;++n){let a=n/(o-1),l=Math.pow(a,i),c=2*Math.PI*(r/3+t*a),d=e*l*(1-l)/2,p=Math.cos(c),v=Math.sin(c),f=l+d*(-.14861*p+1.78277*v),S=l+d*(-.29227*p-.90649*v),A=l+d*1.97294*p;s[n]=[Math.floor(Math.max(0,Math.min(255,256*f))),Math.floor(Math.max(0,Math.min(255,256*S))),Math.floor(Math.max(0,Math.min(255,256*A)))]}return s}var Gt=Wo(2,1,3,1);function Zo(){let r=[.13572138,4.6153926,-42.66032258,132.13108234,-152.94239396,59.28637943],t=[.09140261,2.19418839,4.84296658,-14.18503333,4.27729857,2.82956604],e=[.1066733,12.64194608,-60.58204836,110.36276771,-89.90310912,27.34824973],i=(n,a)=>n[0]*a[0]+n[1]*a[1]+n[2]*a[2]+n[3]*a[3]+n[4]*a[4]+n[5]*a[5],s=new Array(256),o=s.length;for(let n=0;n<o;++n){let a=n/255,l=[1,a,a*a,a*a*a,a*a*a*a,a*a*a*a*a];s[n]=[Math.floor(Math.max(0,Math.min(255,255*i(l,r)))),Math.floor(Math.max(0,Math.min(255,255*i(l,t)))),Math.floor(Math.max(0,Math.min(255,255*i(l,e))))]}return s}var Wl=Zo();var T=class{constructor(t,e=4){this.handler=t;this.minPixelDelta=e;this.onPointerMove=i=>this.drag(i),this.onPointerUp=i=>this.finish(i),this.onPointerCancel=i=>this.cancel(i)}startDragging(t){t.button==0&&(this.dragData&&(this.handler.cancelDrag(),this.dragData.release()),this.dragData=new Zi(t,this.minPixelDelta,this.onPointerMove,this.onPointerUp,this.onPointerCancel),this.dragData.capture(),this.drag(t),t.preventDefault())}drag(t){if(this.dragData===void 0)return;t.preventDefault();let{start:e,moved:i,x:s,y:o}=this.dragData.delta(t);i&&(e&&this.handler.startDrag(),this.handler.drag(s,o))}finish(t){this.dragData!==void 0&&(this.dragData.hasMoved()?(this.handler.finishDrag(),t.preventDefault()):this.handler.onClick(t),this.release())}cancel(t){this.dragData!==void 0&&(this.handler.cancelDrag(),t.preventDefault(),this.release())}release(){this.dragData?.release(),this.dragData=void 0}},Zi=class{constructor(t,e,i,s,o){this.minPixelDelta=e;this.move=i;this.up=s;this.cancel=o;this.moved=!1,this.startX=t.clientX,this.startY=t.clientY,this.pointerId=t.pointerId,this.target=t.target}capture(){this.target.addEventListener("pointermove",this.move),this.target.addEventListener("pointerup",this.up),this.target.addEventListener("pointercancel",this.cancel),this.target.setPointerCapture(this.pointerId)}release(){this.target.removeEventListener("pointermove",this.move),this.target.removeEventListener("pointerup",this.up),this.target.removeEventListener("pointercancel",this.cancel),this.target.releasePointerCapture(this.pointerId)}hasMoved(){return this.moved}delta(t){let e=!1;!this.moved&&this.minPixelDelta==0&&(e=!0,this.moved=!0);let i={start:e,moved:this.moved,x:t.clientX-this.startX,y:t.clientY-this.startY};return i.moved||Math.max(Math.abs(i.x),Math.abs(i.y))>=this.minPixelDelta&&(this.moved=!0,i.moved=!0,i.start=!0),i}};var pi=class{constructor(){this.palette=Gt;this.images=[]}addFloatSpectrum(t,e,i,s,o){let n=t.length;if(this.prepareImageStack(n),s!==void 0&&o!==void 0){if(s!==this.frequency&&this.frequency!==void 0){let c=(s-this.frequency)/o;this.images.map(d=>d.scroll(c))}this.frequency=s}let a=this.images.map(c=>c.startRow(n,e,i)),l=n/2;for(let c=0;c<n;++c)a.map(d=>d.addBin(t[(c+l)%n]))}draw(t,e){let i=e.level*t.canvas.offsetWidth;(this.images.find(o=>o.width>=i)||this.images[this.images.length-1])?.draw(t,e)}prepareImageStack(t){let e=this.images[this.images.length-1];if((e?.width||0)==t)return;let s=[1024,2048,8192,32768].filter(a=>a<t);s.push(t);let o=0,n=0;for(;o<s.length||n<this.images.length;){let a=s[o],l=this.images[n]?.width;if(a===void 0||a>l){this.images.splice(n,1);continue}(l===void 0||a<l)&&this.images.splice(n,0,e?.resizeTo(a)||new Vi(a,this.palette)),++o,++n}}},Vi=class r{constructor(t,e){this.width=t;this.palette=e;this.scrollError=0;this.height=screen.height,this.data=new Uint8ClampedArray(4*this.width*(this.height+1)),this.xOffset=0,this.yOffset=0}startRow(t,e,i){return this.deltaY(-1),new Qi(this.data,(this.xOffset+this.yOffset*this.width)*4,t/this.width,e,i,this.palette)}draw(t,e){let i=new Y(e,this.width,this.width);t.canvas.width!=i.visibleBins&&(t.canvas.width=i.visibleBins),t.canvas.height!=t.canvas.offsetHeight&&(t.canvas.height=t.canvas.offsetHeight);let s=Math.min(this.height-this.yOffset,t.canvas.height),o=(this.xOffset+this.yOffset*this.width)*4,n=o+s*this.width*4;t.putImageData(new ImageData(this.data.subarray(o,n),this.width),-i.leftBin,0);let a=t.canvas.height-s;if(a<=0)return;let l=(this.xOffset+a*this.width)*4;t.putImageData(new ImageData(this.data.subarray(this.xOffset*4,l),this.width),-i.leftBin,s)}scroll(t){if(t>=1||t<=-1){this.data.fill(0),this.xOffset=0,this.yOffset=0,this.scrollError=0;return}t+=this.scrollError;let e=Math.round(this.width*t);if(this.scrollError=t-e/this.width,e==0)return;this.deltaX(e);let i=e>0?-e:0,s=e>0?0:-e;for(let o=0;o<=this.height;++o){let n=o*this.width+this.xOffset;this.data.fill(0,(n+i)*4,(n+s)*4)}}resizeTo(t){let e=new OffscreenCanvas(this.width,this.height);e.getContext("2d").putImageData(new ImageData(this.data.subarray(this.xOffset*4,(this.xOffset+this.height*this.width)*4),this.width),0,0);let o=new OffscreenCanvas(t,this.height).getContext("2d");o.drawImage(e,0,0,t,this.height);let n=new r(t,this.palette);return n.data.set(o.getImageData(0,0,t,this.height).data),n.xOffset=0,n.yOffset=this.yOffset,n.scrollError=this.scrollError,n}deltaX(t){let e=this.xOffset+t,i=0;if(e<0){let s=this.height*this.width*4;for(this.data.copyWithin(s+this.xOffset*4,this.xOffset*4,this.width*4);e<0;)e+=this.width,i--}if(e>=this.width){let s=this.height*this.width*4;for(this.data.copyWithin(0,s,s+this.xOffset*4);e>=this.width;)e-=this.width,i++}this.xOffset=e,i!=0&&this.deltaY(i)}deltaY(t){let e=this.yOffset+t;for(;e<0;)e+=this.height;for(;e>=this.height;)e-=this.height;this.yOffset=e}},Qi=class{constructor(t,e,i,s,o,n){this.data=t;this.offset=e;this.ratio=i;this.palette=n;this.p=0;this.value=0;this.sub=s,this.mul=256/(o-s)}addBin(t){if((this.p==0||t>this.value)&&(this.value=t),this.p++,this.p<this.ratio)return;let e=Math.max(0,Math.min(255,Math.floor(this.mul*(this.value-this.sub)))),i=this.palette[isNaN(e)?0:e];this.data[this.offset++]=i[0],this.data[this.offset++]=i[1],this.data[this.offset++]=i[2],this.data[this.offset++]=255,this.p=0}};var vt=function(r,t,e,i){var s=arguments.length,o=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(n=r[a])&&(o=(s<3?n(o):s>3?n(t,e,o):n(t,e))||o);return s>3&&o&&Object.defineProperty(t,e,o),o},wt=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},kr,Hr,H=class extends g{static get styles(){return[b`
        #waterfall {
          width: 100%;
          height: 100%;
        }
      `]}render(){return u`<canvas id="waterfall"></canvas>`}constructor(){super(),this.minDecibels=-100,this.maxDecibels=-30,this.palette=Gt,this.fftSize=2048,this.zoom=I,this.draggable=!1,this.image=new pi,this.addEventListener("pointerdown",t=>this.onPointerDown(t))}firstUpdated(t){super.firstUpdated(t),this.dragController=new T(new Yi(this))}updated(t){super.updated(t),t.has("zoom")&&this.redraw()}addFloatSpectrum(t,e){this.image.addFloatSpectrum(e,this.minDecibels,this.maxDecibels,t,this.bandwidth),this.redraw()}redraw(){let t=this.getContext();t&&this.image.draw(t,this.zoom)}getContext(){return this.context?this.context:this.canvas?(this.context=this.canvas.getContext("2d"),new ResizeObserver(()=>this.redraw()).observe(this.canvas),this.context):void 0}onPointerDown(t){this.draggable&&this.dragController?.startDragging(t)}};vt([h({type:Number,reflect:!0,attribute:"min-decibels"}),wt("design:type",Number)],H.prototype,"minDecibels",void 0);vt([h({type:Number,reflect:!0,attribute:"max-decibels"}),wt("design:type",Number)],H.prototype,"maxDecibels",void 0);vt([h({attribute:!1}),wt("design:type",Object)],H.prototype,"palette",void 0);vt([h({type:Number,reflect:!0}),wt("design:type",Number)],H.prototype,"fftSize",void 0);vt([h({attribute:!1}),wt("design:type",typeof(kr=typeof x<"u"&&x)=="function"?kr:Object)],H.prototype,"zoom",void 0);vt([h({type:Number,reflect:!0}),wt("design:type",Number)],H.prototype,"bandwidth",void 0);vt([h({type:Boolean,reflect:!0}),wt("design:type",Boolean)],H.prototype,"draggable",void 0);vt([w("#waterfall"),wt("design:type",typeof(Hr=typeof HTMLCanvasElement<"u"&&HTMLCanvasElement)=="function"?Hr:Object)],H.prototype,"canvas",void 0);H=vt([y("rr-waterfall"),wt("design:paramtypes",[])],H);var Yi=class{constructor(t){this.waterfall=t,this.fraction=0}startDrag(){this.fraction=0,this.waterfall.dispatchEvent(new It({fraction:0,target:"waterfall",operation:"start"}))}drag(t,e){this.fraction=t/(this.waterfall.clientWidth*this.waterfall.zoom.level),this.waterfall.dispatchEvent(new It({fraction:this.fraction,target:"waterfall"}))}finishDrag(){this.waterfall.dispatchEvent(new It({fraction:this.fraction,target:"waterfall",operation:"finish"}))}cancelDrag(){this.waterfall.dispatchEvent(new It({fraction:0,target:"waterfall",operation:"cancel"}))}onClick(t){let i=new Y(this.waterfall.zoom,this.waterfall.offsetWidth,this.waterfall.fftSize).unzoomed(t.offsetX/this.waterfall.offsetWidth);this.waterfall.dispatchEvent(new Vt({fraction:i,target:"waterfall"})),t.preventDefault()}};var xt=function(r,t,e,i){var s=arguments.length,o=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(n=r[a])&&(o=(s<3?n(o):s>3?n(t,e,o):n(t,e))||o);return s>3&&o&&Object.defineProperty(t,e,o),o},Ct=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},jr,Ur,Wr,Zr,Vr,dt=class extends g{constructor(){super(...arguments),this.minDecibels=-100,this.maxDecibels=-30,this.palette=Gt}static get styles(){return[b`
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
      `]}render(){return u` <input
        id="min"
        type="text"
        .value=${Xt(this.minDecibels)}
        @focus=${this.onMinFocus}
        @blur=${this.onMinBlur}
        @change=${this.onMinChange}
      />
      <canvas id="palette" width="256" height="24"></canvas>
      <input
        id="max"
        type="text"
        .value=${Xt(this.maxDecibels)}
        @focus=${this.onMaxFocus}
        @blur=${this.onMaxBlur}
        @change=${this.onMaxChange}
      />
      <div id="minThumb" @pointerdown=${this.onMinPointerDown}>
        <div class="touchArea"></div>
      </div>
      <div id="maxThumb" @pointerdown=${this.onMaxPointerDown}>
        <div class="touchArea"></div>
      </div>`}firstUpdated(t){super.firstUpdated(t),this.minDragController=new T(new ui("min",this,this.paletteBox),0),this.maxDragController=new T(new ui("max",this,this.paletteBox),0),new ResizeObserver(()=>this.repaintPalette()).observe(document.body),this.repaintPalette()}updated(t){super.updated(t),this.repaintPalette()}repaintPalette(){let t=this.getContext();if(t){for(let e=0;e<t.canvas.width;++e){let s=255*(e*150/255+-150-this.minDecibels)/(this.maxDecibels-this.minDecibels);s<0&&(s=0),s>255&&(s=255),s=Math.floor(s),t.fillStyle=Gi(this.palette[s]),t.fillRect(e,0,1,24)}this.minBox&&(this.minBox.style.backgroundColor=Gi(this.palette[0]),this.minBox.style.color=Qr(this.palette[0])?"white":"black"),this.maxBox&&(this.maxBox.style.backgroundColor=Gi(this.palette[255]),this.maxBox.style.color=Qr(this.palette[255])?"white":"black"),this.minThumb&&this.paletteBox&&(this.minThumb.style.right=(this.minDecibels-0)*this.paletteBox.offsetWidth/-150+this.paletteBox.offsetLeft+"px"),this.maxThumb&&this.paletteBox&&(this.maxThumb.style.left=(this.maxDecibels- -150)*this.paletteBox.offsetWidth/150+this.paletteBox.offsetLeft+"px")}}getContext(){if(this.context)return this.context;if(this.paletteBox)return this.context=this.paletteBox.getContext("2d"),this.context}onMinFocus(t){let e=t.target;e.value=Xi(this.minDecibels)}onMinBlur(t){let e=t.target;e.value=Xt(this.minDecibels)}onMinChange(t){let e=t.target,i=e.value;i.endsWith("dB")&&(i=i.substring(0,i.length-2).trim());let s=Number(i);isNaN(s)?e.value=Xt(this.minDecibels):Yr(s,this)}onMaxFocus(t){let e=t.target;e.value=Xi(this.maxDecibels)}onMaxBlur(t){let e=t.target;e.value=Xt(this.maxDecibels)}onMaxChange(t){let e=t.target,i=e.value;i.endsWith("dB")&&(i=i.substring(0,i.length-2).trim());let s=Number(i);isNaN(s)?e.value=Xt(this.maxDecibels):Gr(s,this)}onMinPointerDown(t){this.minDragController?.startDragging(t)}onMaxPointerDown(t){this.maxDragController?.startDragging(t)}};xt([h({type:Number,reflect:!0,attribute:"min-decibels"}),Ct("design:type",Number)],dt.prototype,"minDecibels",void 0);xt([h({type:Number,reflect:!0,attribute:"max-decibels"}),Ct("design:type",Number)],dt.prototype,"maxDecibels",void 0);xt([h({attribute:!1}),Ct("design:type",Object)],dt.prototype,"palette",void 0);xt([w("#min"),Ct("design:type",typeof(jr=typeof HTMLElement<"u"&&HTMLElement)=="function"?jr:Object)],dt.prototype,"minBox",void 0);xt([w("#max"),Ct("design:type",typeof(Ur=typeof HTMLElement<"u"&&HTMLElement)=="function"?Ur:Object)],dt.prototype,"maxBox",void 0);xt([w("#palette"),Ct("design:type",typeof(Wr=typeof HTMLCanvasElement<"u"&&HTMLCanvasElement)=="function"?Wr:Object)],dt.prototype,"paletteBox",void 0);xt([w("#minThumb"),Ct("design:type",typeof(Zr=typeof HTMLElement<"u"&&HTMLElement)=="function"?Zr:Object)],dt.prototype,"minThumb",void 0);xt([w("#maxThumb"),Ct("design:type",typeof(Vr=typeof HTMLElement<"u"&&HTMLElement)=="function"?Vr:Object)],dt.prototype,"maxThumb",void 0);dt=xt([y("rr-decibel-range")],dt);function Gi(r){return`rgb(${r[0]}, ${r[1]}, ${r[2]})`}function Qr(r){return Math.max(r[0],r[1],r[2])<96}var ui=class{constructor(t,e,i){this.type=t,this.range=e,this.box=i,this.startDb=0}startDrag(){this.startDb=this.type==="min"?this.range.minDecibels:this.range.maxDecibels}drag(t,e){let i=t/this.box.offsetWidth;this.changeDb(this.startDb+i*150)}finishDrag(){}cancelDrag(){this.changeDb(this.startDb)}onClick(){}changeDb(t){this.type=="min"?Yr(t,this.range):Gr(t,this.range)}};function Yr(r,t){r=Math.round(r),r<-150&&(r=-150),r>0&&(r=0),r>t.maxDecibels-6&&(r=t.maxDecibels-6),t.minDecibels=r,t.dispatchEvent(new $e({min:r}))}function Gr(r,t){r=Math.round(r),r<-150&&(r=-150),r>0&&(r=0),r<t.minDecibels+6&&(r=t.minDecibels+6),t.maxDecibels=r,t.dispatchEvent(new $e({max:r}))}function Xt(r){return Xi(r)+" dB"}function Xi(r){return String(r)}var Lt=function(r,t,e,i){var s=arguments.length,o=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(n=r[a])&&(o=(s<3?n(o):s>3?n(t,e,o):n(t,e))||o);return s>3&&o&&Object.defineProperty(t,e,o),o},Kt=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},Xr,Mt=class extends g{constructor(){super(...arguments),this.draggablePoint=!1,this.draggableLeft=!1,this.draggableRight=!1,this.fftSize=2048,this.zoom=I}static get styles(){return[b`
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
      `]}render(){return u`${this.renderBand()}${this.renderPoint()}`}renderPoint(){if(this.selection?.point===void 0)return m;let e=new Y(this.zoom,this.offsetWidth,this.fftSize).zoomed(this.selection.point);return e<0||e>1?m:u`<div id="point" style="left:calc(${100*e}% - 1px)"></div>
      ${this.draggablePoint?u`<div
            id="pointHandle"
            class="handle"
            style="left:calc(${100*e}% - 2px)"
            @pointerdown=${this.onPointPointerDown}
          >
            <div class="touchArea"></div>
          </div>`:m}`}renderBand(){if(this.selection?.band===void 0)return m;let t=new Y(this.zoom,this.offsetWidth,this.fftSize),e=t.zoomed(this.selection.band.left),i=t.zoomed(this.selection.band.right);if(e>1||i<0)return m;let s=Math.max(0,e),o=Math.min(i,1);return u`<div
        id="band"
        style="left:${100*s}%;width:${100*(o-s)}%"
      ></div>
      ${this.draggableLeft&&e==s?u`<div
            id="leftBandHandle"
            class="handle"
            style="left:calc(${100*e}% - 2px)"
            @pointerdown=${this.onLeftPointerDown}
          >
            <div class="touchArea"></div>
          </div>`:m}${this.draggableRight&&i==o?u`<div
            id="rightBandHandle"
            class="handle"
            style="left:calc(${100*i}% - 2px)"
            @pointerdown=${this.onRightPointerDown}
          >
            <div class="touchArea"></div>
          </div>`:m}`}firstUpdated(t){super.firstUpdated(t),this.pointDragController=new T(new Me("point",this),0),this.leftDragController=new T(new Me("start",this),0),this.rightDragController=new T(new Me("end",this),0)}onPointPointerDown(t){this.pointDragController?.startDragging(t)}onLeftPointerDown(t){this.leftDragController?.startDragging(t)}onRightPointerDown(t){this.rightDragController?.startDragging(t)}};Lt([h({type:Boolean,reflect:!0,attribute:"draggable-point"}),Kt("design:type",Boolean)],Mt.prototype,"draggablePoint",void 0);Lt([h({type:Boolean,reflect:!0,attribute:"draggable-left"}),Kt("design:type",Boolean)],Mt.prototype,"draggableLeft",void 0);Lt([h({type:Boolean,reflect:!0,attribute:"draggable-right"}),Kt("design:type",Boolean)],Mt.prototype,"draggableRight",void 0);Lt([h({type:Number,reflect:!0}),Kt("design:type",Number)],Mt.prototype,"fftSize",void 0);Lt([h({attribute:!1}),Kt("design:type",typeof(Xr=typeof x<"u"&&x)=="function"?Xr:Object)],Mt.prototype,"zoom",void 0);Lt([h({attribute:!1}),Kt("design:type",Object)],Mt.prototype,"selection",void 0);Mt=Lt([y("rr-highlight")],Mt);var Me=class{constructor(t,e){this.type=t,this.highlight=e}startDrag(){this.original=this.highlight.selection}drag(t,e){let i=this.highlight.zoom===void 0?1:this.highlight.zoom.level,s=this.getFraction();s!==void 0&&(s+=t/(this.highlight.offsetWidth*i),s<0&&(s=0),s>1&&(s=1),this.highlight.dispatchEvent(this.getEvent(s)))}finishDrag(){}cancelDrag(){let t=this.getFraction();t!==void 0&&this.highlight.dispatchEvent(this.getEvent(t))}onClick(){}getFraction(){return this.type=="point"?this.original?.point:this.type=="start"?this.original?.band?.left:this.original?.band?.right}getEvent(t){return new di(this.type=="point"?{fraction:t}:this.type=="start"?{startFraction:t}:{endFraction:t})}};var et=b`
  :host {
    font-family: Arial, Helvetica, sans-serif;
  }

  @media (prefers-color-scheme: dark) {
    input,
    select {
      background: #222;
      color: #ddd;
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
`;var Ji=function(r,t,e,i){var s=arguments.length,o=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(n=r[a])&&(o=(s<3?n(o):s>3?n(t,e,o):n(t,e))||o);return s>3&&o&&Object.defineProperty(t,e,o),o},to=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},Kr,Jr,fi=class extends g{constructor(){super(...arguments),this.zoom=I}static get styles(){return[et,b`
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
      `]}render(){return u`<button @click=${this.onClickButtonLeft}>
        ${ri}
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
      <button @click=${this.onClickButtonRight}>${oi}</button>`}firstUpdated(t){super.firstUpdated(t),this.dragController=new T(new Ki(this,this.scrollBox),0)}onClickButtonLeft(){this.moveZoom(-1/20)}onClickButtonRight(){this.moveZoom(1/20)}onClickAreaLeft(){this.moveZoom(-.6)}onClickAreaRight(){this.moveZoom(.6)}moveZoom(t){let e=this.zoom.withMovedCenter(t/this.zoom.level);this.zoom=e,this.dispatchEvent(new Nt(e))}onPointerDown(t){this.dragController?.startDragging(t)}};Ji([h({attribute:!1}),to("design:type",typeof(Kr=typeof x<"u"&&x)=="function"?Kr:Object)],fi.prototype,"zoom",void 0);Ji([w("#scroll"),to("design:type",typeof(Jr=typeof HTMLElement<"u"&&HTMLElement)=="function"?Jr:Object)],fi.prototype,"scrollBox",void 0);fi=Ji([y("rr-scrollbar")],fi);var Ki=class{constructor(t,e){this.scrollbar=t,this.box=e,this.startZoom=I}startDrag(){this.startZoom=this.scrollbar.zoom}drag(t,e){let i=t/this.box.offsetWidth;this.moveZoom(i)}finishDrag(){}cancelDrag(){this.moveZoom(0)}onClick(){}moveZoom(t){let e=this.startZoom.withMovedCenter(t);this.scrollbar.zoom=e,this.scrollbar.dispatchEvent(new Nt(this.scrollbar.zoom))}};var es=function(r,t,e,i){var s=arguments.length,o=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(n=r[a])&&(o=(s<3?n(o):s>3?n(t,e,o):n(t,e))||o);return s>3&&o&&Object.defineProperty(t,e,o),o},io=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},eo,mi=class extends g{constructor(){super(...arguments),this.zoom=I}static get styles(){return[et,b`
        :host {
          display: flex;
          flex-direction: row;
        }

        #zoomInput {
          width: 6ex;
        }
      `]}render(){return u`<button @click=${this.onClickMinus}>${ai}</button>
      <input
        id="zoomInput"
        type="text"
        .value=${ts(this.zoom.level)}
        @focus=${this.onZoomFocus}
        @blur=${this.onZoomBlur}
        @change=${this.onZoomChange}
      />
      <button @click=${this.onClickPlus}>${ni}</button>`}onZoomFocus(t){let e=t.target;e.value=so(this.zoom.level)}onZoomBlur(t){let e=t.target;e.value=ts(this.zoom.level)}onZoomChange(t){let e=t.target,i=e.value;i.endsWith("x")&&(i=i.substring(0,i.length-1));let s=Number(i);isNaN(s)?e.value=ts(this.zoom.level):this.setZoom(s)}onClickMinus(){this.setZoom(this.zoom.level/Math.sqrt(2))}onClickPlus(){this.setZoom(this.zoom.level*Math.sqrt(2))}setZoom(t){Math.abs(t-Math.round(t))<.01&&(t=Math.round(t));let e=this.zoom;this.highlight?.point!==void 0?e=e.withLevelInContext(t,this.highlight.point):e=e.withLevel(t),this.zoom=e,this.dispatchEvent(new Nt(e))}};es([h({attribute:!1}),io("design:type",typeof(eo=typeof x<"u"&&x)=="function"?eo:Object)],mi.prototype,"zoom",void 0);es([h({attribute:!1}),io("design:type",Object)],mi.prototype,"highlight",void 0);mi=es([y("rr-zoombar")],mi);function ts(r){return so(r)+"x"}function so(r){return String(Math.round(r*100)/100)}var W=function(r,t,e,i){var s=arguments.length,o=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(n=r[a])&&(o=(s<3?n(o):s>3?n(t,e,o):n(t,e))||o);return s>3&&o&&Object.defineProperty(t,e,o),o},G=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},ro,oo,no,C=class extends g{constructor(){super(...arguments),this.centerFrequency=0,this.frequencyScale=1,this.minDecibels=-100,this.maxDecibels=-30,this.fftSize=2048,this.zoom=I,this.highlightDraggablePoint=!1,this.highlightDraggableLeft=!1,this.highlightDraggableRight=!1,this.waterfallDraggable=!1}static get styles(){return[b`
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
      `]}render(){return u`<div id="view">
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
      </div>`}addFloatSpectrum(t,e){this.fftSize!=e.length&&(this.fftSize=e.length),this.scope?.addFloatSpectrum(e),this.waterfall?.addFloatSpectrum(t,e)}onZoom(t){this.zoom=t.detail}onDecibelRangeChanged(t){t.detail.min!==void 0&&(this.minDecibels=t.detail.min),t.detail.max!==void 0&&(this.maxDecibels=t.detail.max)}};W([h({type:Number,reflect:!0}),G("design:type",Number)],C.prototype,"bandwidth",void 0);W([h({type:Number,reflect:!0,attribute:"center-frequency"}),G("design:type",Number)],C.prototype,"centerFrequency",void 0);W([h({type:Number,reflect:!0,attribute:"frequency-scale"}),G("design:type",Number)],C.prototype,"frequencyScale",void 0);W([h({type:Number,reflect:!0,attribute:"min-decibels"}),G("design:type",Number)],C.prototype,"minDecibels",void 0);W([h({type:Number,reflect:!0,attribute:"max-decibels"}),G("design:type",Number)],C.prototype,"maxDecibels",void 0);W([h({type:Number,reflect:!0}),G("design:type",Number)],C.prototype,"fftSize",void 0);W([h({attribute:!1}),G("design:type",typeof(ro=typeof x<"u"&&x)=="function"?ro:Object)],C.prototype,"zoom",void 0);W([h({attribute:!1}),G("design:type",Object)],C.prototype,"highlight",void 0);W([h({attribute:!1}),G("design:type",Boolean)],C.prototype,"highlightDraggablePoint",void 0);W([h({attribute:!1}),G("design:type",Boolean)],C.prototype,"highlightDraggableLeft",void 0);W([h({attribute:!1}),G("design:type",Boolean)],C.prototype,"highlightDraggableRight",void 0);W([h({attribute:!1}),G("design:type",Boolean)],C.prototype,"waterfallDraggable",void 0);W([w("#scope"),G("design:type",typeof(oo=typeof k<"u"&&k)=="function"?oo:Object)],C.prototype,"scope",void 0);W([w("#waterfall"),G("design:type",typeof(no=typeof H<"u"&&H)=="function"?no:Object)],C.prototype,"waterfall",void 0);C=W([y("rr-spectrum")],C);var X=function(r,t,e,i){var s=arguments.length,o=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(n=r[a])&&(o=(s<3?n(o):s>3?n(t,e,o):n(t,e))||o);return s>3&&o&&Object.defineProperty(t,e,o),o},B=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},ao,M=class extends g{constructor(){super(...arguments),this.label="",this.resizeable=!1,this.closeable=!1,this.fixed=!1,this.closed=!1,this.modal=!1,this.moving=!1}set position(t){this.pendingPosition=t}get position(){return this.pendingPosition||this.getPosition()}set size(t){this.pendingSize=t}get size(){return this.pendingSize||this.getSize()}static get styles(){return[et,b`
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
      `]}render(){return this.closed?m:u`${this.modal?u`<div class="modalbg"></div>`:m}
      <div
        class="label${this.moving?" moving":""}${this.modal?" modal":""}"
        @pointerdown=${this.onLabelPointerDown}
      >
        <div class="label-left" @pointerdown=${this.noPointerDown}>
          <slot name="label-left"></slot>
        </div>
        <div class="label-middle"><slot name="label">${this.label}</slot></div>
        <div class="label-right" @pointerdown=${this.noPointerDown}>
          <slot name="label-right"></slot>${this.closeable?u`<button id="close" @click=${this.onClosePressed}>
                ${Dr}
              </button>`:m}
        </div>
      </div>
      <div class="content${this.resizeable?" resizeable":""}">
        <div class="contentView"><slot></slot></div>
        ${this.resizeable?u`<div
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
                ${Cr}
              </div>`:m}
      </div>`}connectedCallback(){super.connectedCallback(),this.addEventListener("click",t=>this.onSelect(t)),Pe?.register(this)}disconnectedCallback(){super.disconnectedCallback(),Pe?.unregister(this)}firstUpdated(t){super.firstUpdated(t),this.doUpdates(t)}updated(t){super.updated(t),this.doUpdates(t)}doUpdates(t){t.has("closed")&&(Pe?.show(!this.closed,this),this.closed||(this.modal||(this.moveController=new T(new is(this),0)),this.rightResizeController=new T(new Ee(this,this.content,!0,!1),0),this.bottomResizeController=new T(new Ee(this,this.content,!1,!0),0),this.cornerResizeController=new T(new Ee(this,this.content,!0,!0),0),this.dispatchEvent(new os))),this.closed||(this.modal&&(this.pendingSize=void 0,this.pendingPosition=void 0,this.setCenterPosition(),setTimeout(()=>Pe?.select(this),0)),this.pendingSize&&(this.setSize(this.pendingSize),this.pendingSize=void 0),this.pendingPosition&&(this.setPosition(this.pendingPosition),this.pendingPosition=void 0))}getPosition(){if(!(this.closed||this.offsetWidth==0&&this.offsetHeight==0)&&getComputedStyle(this).position=="absolute")return{top:this.offsetTop,left:this.offsetLeft,bottom:visualViewport.height-this.offsetTop-this.offsetHeight,right:visualViewport.width-this.offsetLeft-this.offsetWidth}}getSize(){if(!(!this.resizeable||!this.content||this.closed||this.offsetWidth==0&&this.offsetWidth==0)&&getComputedStyle(this).position=="absolute")return{width:this.offsetWidth,height:this.content.offsetHeight}}setCenterPosition(){let t=this.offsetWidth,e=this.offsetHeight;this.style.left=`calc(50vw - ${t/2}px)`,this.style.top=`calc(50vh - ${e/2}px)`,this.style.right="auto",this.style.bottom="auto"}setPosition(t){let e=visualViewport.width,i=visualViewport.height,s=t.left+this.offsetWidth<=e,o=t.right+this.offsetWidth<=e,n=t.top+this.offsetHeight<=i,a=t.bottom+this.offsetHeight<=i,l=t.left<=t.right,c=t.top<=t.bottom;l&&s?(this.style.left=`${t.left}px`,this.style.right="auto"):!l&&o?(this.style.right=`${t.right}px`,this.style.left="auto"):(this.style.left=`${Math.max(0,Math.floor((e-this.offsetWidth)/2))}px`,this.style.right="auto"),c&&n?(this.style.top=`${t.top}px`,this.style.bottom="auto"):!c&&a?(this.style.bottom=`${t.bottom}px`,this.style.top="auto"):(this.style.top=`${Math.max(0,Math.floor((i-this.offsetHeight)/2))}px`,this.style.bottom="auto")}setSize(t){if(this.content===void 0)return;let e=visualViewport.width,i=visualViewport.height,s=this.offsetTop+this.content.offsetTop,o=this.offsetLeft+this.content.offsetLeft;t.width>=e&&(t.width=Math.floor(e)),t.height+this.content.offsetTop>=i&&(t.height=Math.floor(i-this.content.offsetTop));let n=o+this.content.offsetWidth<=e,a=s+this.content.offsetHeight<=i;if(!n){let l=Math.floor(e-t.width-this.content.offsetLeft);this.style.left=`${l}px`,this.style.right="auto"}if(!a){let l=Math.floor(i-t.height-this.content.offsetTop);this.style.top=`${l}px`,this.style.bottom="auto"}ns(this,this.content,t.width,t.height)}onClosePressed(){this.closed=!0,this.dispatchEvent(new rs)}onSelect(t){Pe?.select(this)&&t.stopPropagation()}noPointerDown(t){t.stopPropagation()}onLabelPointerDown(t){this.fixed||this.moveController?.startDragging(t)}onRightResizerPointerDown(t){this.fixed||this.rightResizeController?.startDragging(t)}onBottomResizerPointerDown(t){this.fixed||this.bottomResizeController?.startDragging(t)}onCornerResizerPointerDown(t){this.fixed||this.cornerResizeController?.startDragging(t)}};X([h({type:String,reflect:!0}),B("design:type",String)],M.prototype,"label",void 0);X([h({type:Boolean,reflect:!0}),B("design:type",Boolean)],M.prototype,"resizeable",void 0);X([h({type:Boolean,reflect:!0}),B("design:type",Boolean)],M.prototype,"closeable",void 0);X([h({type:Boolean,reflect:!0}),B("design:type",Boolean)],M.prototype,"fixed",void 0);X([h({type:Boolean,reflect:!0}),B("design:type",Boolean)],M.prototype,"closed",void 0);X([h({type:Boolean,reflect:!0}),B("design:type",Boolean)],M.prototype,"modal",void 0);X([h({attribute:!1}),B("design:type",Object),B("design:paramtypes",[Object])],M.prototype,"position",null);X([h({attribute:!1}),B("design:type",Object),B("design:paramtypes",[Object])],M.prototype,"size",null);X([Z(),B("design:type",Boolean)],M.prototype,"moving",void 0);X([w(".content"),B("design:type",typeof(ao=typeof HTMLDivElement<"u"&&HTMLDivElement)=="function"?ao:Object)],M.prototype,"content",void 0);M=X([y("rr-window")],M);function Jt(r){class t extends r{set closed(i){this.pendingClosed=i}get closed(){return this.pendingClosed!==void 0?this.pendingClosed:this.window?.closed||!1}set position(i){this.pendingPosition=i}get position(){return this.pendingPosition||this.window?.position}set size(i){this.pendingSize=i}get size(){return this.pendingSize||this.window?.size}firstUpdated(i){super.firstUpdated(i),this.doUpdate()}updated(i){super.updated(i),this.doUpdate()}doUpdate(){this.pendingClosed!==void 0&&this.window&&(this.window.closed=this.pendingClosed,this.pendingClosed=void 0),this.pendingSize!==void 0&&this.window&&(this.window.size=this.pendingSize,this.pendingSize=void 0),this.pendingPosition!==void 0&&this.window&&(this.window.position=this.pendingPosition,this.pendingPosition=void 0)}}return X([h({type:Boolean,reflect:!0}),B("design:type",Boolean),B("design:paramtypes",[Boolean])],t.prototype,"closed",null),X([h({attribute:!1}),B("design:type",Object),B("design:paramtypes",[Object])],t.prototype,"position",null),X([h({attribute:!1}),B("design:type",Object),B("design:paramtypes",[Object])],t.prototype,"size",null),t}function lo(r){let t=r.getBoundingClientRect(),e=t.left+window.scrollX,i=t.top+window.scrollY;r.style.left=`${e}px`,r.style.top=`${i}px`,r.style.right="auto",r.style.bottom="auto"}function Vo(r,t,e){let i=r.offsetLeft,s=r.offsetTop;t>visualViewport.width-r.offsetWidth&&(t=visualViewport.width-r.offsetWidth),e>visualViewport.height-r.offsetHeight&&(e=visualViewport.height-r.offsetHeight),t<0&&(t=0),e<0&&(e=0),(t!=i||e!=s)&&ho(r,Math.floor(t),Math.floor(e))}function Qo(r,t,e,i){let s=r.offsetLeft,o=r.offsetTop,n=t.offsetTop;s+e>visualViewport.width&&(e=visualViewport.width-s),o+n+i>visualViewport.height&&(i=visualViewport.height-o-n),i<32&&(i=32),(e!=t.offsetWidth||i!=t.offsetHeight)&&ns(r,t,Math.floor(e),Math.floor(i))}function ho(r,t,e){r.style.left=t+"px",r.style.top=e+"px"}function ns(r,t,e,i){t.style.width=e+"px",t.style.height=i+"px",t.offsetWidth<r.offsetWidth&&(t.style.width=r.offsetWidth+"px")}var is=class{constructor(t){this.window=t,this.elemX=t.offsetLeft,this.elemY=t.offsetTop}startDrag(){lo(this.window),this.window.moving=!0,this.elemX=this.window.offsetLeft,this.elemY=this.window.offsetTop}drag(t,e){Vo(this.window,this.elemX+t,this.elemY+e)}finishDrag(){this.window.moving=!1,this.window.dispatchEvent(new gi)}cancelDrag(){this.window.moving=!1,ho(this.window,this.elemX,this.elemY)}onClick(){}},Ee=class{constructor(t,e,i,s){this.window=t,this.content=e,this.right=i,this.bottom=s,this.sizeX=e.offsetWidth,this.sizeY=e.offsetHeight}startDrag(){lo(this.window),this.sizeX=this.content.offsetWidth,this.sizeY=this.content.offsetHeight}drag(t,e){Qo(this.window,this.content,this.right?this.sizeX+t:this.sizeX,this.bottom?this.sizeY+e:this.sizeY)}finishDrag(){this.window.dispatchEvent(new gi),this.window.dispatchEvent(new ss)}cancelDrag(){ns(this.window,this.content,this.sizeX,this.sizeY)}onClick(){}};var Pe;var gi=class extends Event{constructor(){super("rr-window-moved",{bubbles:!0,composed:!0})}},ss=class extends Event{constructor(){super("rr-window-resized",{bubbles:!0,composed:!0})}},rs=class extends Event{constructor(){super("rr-window-closed",{bubbles:!0,composed:!0})}},os=class extends Event{constructor(){super("rr-window-open",{bubbles:!0,composed:!0})}};var ee=function(r,t,e,i){var s=arguments.length,o=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(n=r[a])&&(o=(s<3?n(o):s>3?n(t,e,o):n(t,e))||o);return s>3&&o&&Object.defineProperty(t,e,o),o},te=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},kt=class extends g{constructor(){super(...arguments),this.min=0,this.frequency=0,this._scale=1,this.step=1}get scale(){return this._scale}set scale(t){if(t!=1&&t!=1e3&&t!=1e6)return;let e=this._scale;this._scale=t,this.requestUpdate("scale",e)}static get styles(){return[b`
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
      `]}render(){return u`<input
        type="number"
        id="frequency"
        .step=${String(this.step/this.scale)}
        .value=${String(this.frequency/this.scale)}
        @change=${this.onFrequencyChange}
      /><select id="scale" @change=${this.onScaleChange}>
        <option value="1" .selected=${this.scale==1}>Hz</option>
        <option value="1000" .selected=${this.scale==1e3}>kHz</option>
        <option value="1000000" .selected=${this.scale==1e6}>MHz</option>
      </select>`}onFrequencyChange(t){let e=t.target,i=Number(e.value);if(!isNaN(i)){let s=i*this.scale;if(s>=this.min&&(this.max===void 0||s<=this.max)){this.frequency=i*this.scale,this.dispatchEvent(new Event("change"));return}}e.value=String(this.frequency/this.scale)}onScaleChange(t){let e=t.target,i=Number(e.selectedOptions[0].value);this.scale=i,this.dispatchEvent(new Event("scale-change"))}};ee([h({type:Number,reflect:!0}),te("design:type",Number)],kt.prototype,"min",void 0);ee([h({type:Number,reflect:!0}),te("design:type",Number)],kt.prototype,"max",void 0);ee([h({type:Number,reflect:!0}),te("design:type",Number)],kt.prototype,"frequency",void 0);ee([h({type:Number,reflect:!0}),te("design:type",Number),te("design:paramtypes",[Number])],kt.prototype,"scale",null);ee([h({type:Number,reflect:!0}),te("design:type",Number)],kt.prototype,"step",void 0);kt=ee([y("rr-frequency-input")],kt);var _=function(r,t,e,i){var s=arguments.length,o=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(n=r[a])&&(o=(s<3?n(o):s>3?n(t,e,o):n(t,e))||o);return s>3&&o&&Object.defineProperty(t,e,o),o},R=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},co,P=class extends Jt(g){constructor(){super(...arguments),this.inline=!1,this.showSettings=!0,this.showHelp=!0,this.needsReload=!1,this.playing=!1,this.scale=1e3,this.centerFrequency=885e5,this.tunedFrequency=885e5,this.tuningStep=1e3,this.availableSchemes=vr(),this.scheme="WBFM",this.bandwidth=15e4,this.stereo=!0,this.squelch=0,this.stereoStatus=!1,this.gain=null,this.gainDisabled=!1,this.savedGain=0}static get styles(){return[et,b`
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

        label[for="centerFrequency"],
        label[for="tunedFrequency"],
        label[for="tuningStep"] {
          width: 16ex;
          display: inline-block;
          text-align: right;
          padding-right: 0.5ex;
        }
      `]}render(){return u`<rr-window
      label="Controls"
      id="controls"
      class=${this.inline?"inline":""}
      .position=${this.position}
      .fixed=${this.inline}
    >
      ${this.needsReload?u`<button slot="label-left" id="needsReload" @click=${this.onReload}>
            ${_r}
          </button>`:this.playing?u`<button slot="label-left" id="stop" @click=${this.onStop}>
              ${ei}
            </button>`:u`<button slot="label-left" id="start" @click=${this.onStart}>
              ${ii}
            </button>`}
      <button slot="label-right" id="presets" @click=${this.onPresets}>
        ${ci}
      </button>
      ${this.showSettings?u`<button
            slot="label-right"
            id="settings"
            @click=${this.onSettings}
          >
            ${si}
          </button>`:m}
      ${this.showHelp?u`<a slot="label-right" href="help.html" target="_blank"
            ><button id="help">${Mr}</button></a
          >`:m}
      <div>
        <label for="centerFrequency">Center frequency: </label
        ><rr-frequency-input
          id="centerFrequency"
          .min=${0}
          .max=${18e8}
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
          min=${0}
          max=${18e8}
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
          ${this.availableSchemes.map(t=>u`<option value="${t}" .selected=${this.scheme==t}>
                ${t}
              </option>`)}
        </select>
        <div class="cfgBlock">
          <span .hidden=${!V(this.scheme).hasBandwidth()}
            ><label for="bandwidth">Bandwidth: </label
            ><input
              type="number"
              id="bandwidth"
              min="0"
              max="20000"
              step="1"
              .value=${String(this.bandwidth)}
              @change=${this.onBandwidthChange} /></span
          ><span .hidden=${!V(this.scheme).hasStereo()}>
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
              .hidden=${!V(this.scheme).hasStereo()||!this.stereo}
              >${Er}</span
            ></span
          ><span .hidden=${!V(this.scheme).hasSquelch()}>
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
    </rr-window>`}onStart(){this.dispatchEvent(new as)}onStop(){this.dispatchEvent(new ls)}onReload(){location.reload()}onPresets(){this.dispatchEvent(new hs)}onSettings(){this.dispatchEvent(new cs)}onScaleChange(t){let e=t.target;this.scale=e.scale,this.dispatchEvent(new ds)}onCenterFrequencyChange(t){let e=t.target;this.centerFrequency=e.frequency,this.dispatchEvent(new ps)}onTunedFrequencyChange(t){let e=t.target;this.tunedFrequency=e.frequency,this.dispatchEvent(new us)}onTuningStepChange(t){let e=t.target,i=Number(e.value);if(isNaN(i)){e.value=String(this.tuningStep);return}this.tuningStep=i,this.dispatchEvent(new fs)}onModeChange(t){this.scheme=t.target.selectedOptions[0].value,this.dispatchEvent(new ms)}onBandwidthChange(t){let e=t.target,i=Number(e.value);if(isNaN(i)){e.value=String(this.bandwidth);return}this.bandwidth=i,this.dispatchEvent(new gs)}onStereoChange(t){let e=t.target;this.stereo=e.checked,this.dispatchEvent(new bs)}onSquelchChange(t){let e=t.target,i=Number(e.value);(isNaN(i)||i<0)&&(i=0,e.value=String(i)),i>6&&(i=6,e.value=String(i)),this.squelch=i,this.dispatchEvent(new ys)}onGainInput(t){let e=t.target,i=Number(e.value);if(isNaN(i)){e.value=this.gain==null?"":String(this.gain);return}this.gain=i,this.dispatchEvent(new bi)}onGainAutoChange(t){t.target.checked?(this.gain!=null&&(this.savedGain=this.gain),this.gain=null):this.gain=this.savedGain,this.dispatchEvent(new bi)}};_([h({attribute:!1}),R("design:type",Boolean)],P.prototype,"inline",void 0);_([h({attribute:!1}),R("design:type",Boolean)],P.prototype,"showSettings",void 0);_([h({attribute:!1}),R("design:type",Boolean)],P.prototype,"showHelp",void 0);_([h({attribute:!1}),R("design:type",Boolean)],P.prototype,"needsReload",void 0);_([h({attribute:!1}),R("design:type",Boolean)],P.prototype,"playing",void 0);_([h({attribute:!1}),R("design:type",Number)],P.prototype,"scale",void 0);_([h({attribute:!1}),R("design:type",Number)],P.prototype,"centerFrequency",void 0);_([h({attribute:!1}),R("design:type",Number)],P.prototype,"tunedFrequency",void 0);_([h({attribute:!1}),R("design:type",Number)],P.prototype,"tuningStep",void 0);_([h({attribute:!1}),R("design:type",Array)],P.prototype,"availableSchemes",void 0);_([h({attribute:!1}),R("design:type",String)],P.prototype,"scheme",void 0);_([h({attribute:!1}),R("design:type",Number)],P.prototype,"bandwidth",void 0);_([h({attribute:!1}),R("design:type",Boolean)],P.prototype,"stereo",void 0);_([h({attribute:!1}),R("design:type",Number)],P.prototype,"squelch",void 0);_([h({attribute:!1}),R("design:type",Boolean)],P.prototype,"stereoStatus",void 0);_([h({attribute:!1}),R("design:type",Object)],P.prototype,"gain",void 0);_([h({attribute:!1}),R("design:type",Boolean)],P.prototype,"gainDisabled",void 0);_([Z(),R("design:type",Number)],P.prototype,"savedGain",void 0);_([w("rr-window"),R("design:type",typeof(co=typeof M<"u"&&M)=="function"?co:Object)],P.prototype,"window",void 0);P=_([y("rr-main-controls")],P);var as=class extends Event{constructor(){super("rr-start",{bubbles:!0,composed:!0})}},ls=class extends Event{constructor(){super("rr-stop",{bubbles:!0,composed:!0})}},hs=class extends Event{constructor(){super("rr-presets",{bubbles:!0,composed:!0})}},cs=class extends Event{constructor(){super("rr-settings",{bubbles:!0,composed:!0})}},ds=class extends Event{constructor(){super("rr-scale-changed",{bubbles:!0,composed:!0})}},ps=class extends Event{constructor(){super("rr-center-frequency-changed",{bubbles:!0,composed:!0})}},us=class extends Event{constructor(){super("rr-tuned-frequency-changed",{bubbles:!0,composed:!0})}},fs=class extends Event{constructor(){super("rr-tuning-step-changed",{bubbles:!0,composed:!0})}},ms=class extends Event{constructor(){super("rr-scheme-changed",{bubbles:!0,composed:!0})}},gs=class extends Event{constructor(){super("rr-bandwidth-changed",{bubbles:!0,composed:!0})}},bs=class extends Event{constructor(){super("rr-stereo-changed",{bubbles:!0,composed:!0})}},ys=class extends Event{constructor(){super("rr-squelch-changed",{bubbles:!0,composed:!0})}},bi=class extends Event{constructor(){super("rr-gain-changed",{bubbles:!0,composed:!0})}};var D=function(r,t,e,i){var s=arguments.length,o=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(n=r[a])&&(o=(s<3?n(o):s>3?n(t,e,o):n(t,e))||o);return s>3&&o&&Object.defineProperty(t,e,o),o},E=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},po,uo,$=class extends Jt(g){constructor(){super(...arguments),this.inline=!1,this.hidden=!1,this.tunedFrequency=885e5,this.scale=1e3,this.tuningStep=1e3,this.scheme="WBFM",this.bandwidth=15e4,this.stereo=!0,this.squelch=0,this.gain=null,this.sortColumn="frequency",this.presets=[],this.sortedIndices=[],this.editorOpen=!1,this.editorContent={name:"",tunedFrequency:this.tunedFrequency,scale:this.scale,tuningStep:this.tuningStep,scheme:this.scheme,bandwidth:this.bandwidth,stereo:this.stereo,squelch:this.squelch,gain:this.gain}}static get styles(){return[et,b`
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
      `]}render(){return u`<rr-window
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
          ${Se}
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
          ${this.sortedIndices.map(t=>u`<tr
                data-index=${t}
                class=${t==this.selectedIndex?"active":""}
                @click=${this.onRowClick}
              >
                <td>${this.presets[t].name}</td>
                <td>
                  ${yi(this.presets[t].tunedFrequency,this.presets[t].scale)}
                </td>
                <td>${this.presets[t].scheme}</td>
                <td>
                  <a href="javascript:0" @click=${this.onRowEditClick}
                    >${li}</a
                  ><a href="javascript:0" @click=${this.onRowDeleteClick}
                    >${hi}</a
                  >
                </td>
              </tr>`)}
        </table>
        ${this.presets.length==0?u`<p style="max-width: 50ex">
              You can use Presets to flip quickly to your favorite stations or
              frequencies. Click the
              <button disabled class="buttonIllustration">${Se}</button>
              button on this window's top left corner to add the current
              frequency to the presets.
            </p>`:m}
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
            >${yi(this.editorContent.tunedFrequency,this.editorContent.scale)}</b
          >, Tuning step:
          <b>${yi(this.editorContent.tuningStep,1)}</b>
        </div>
        <div>
          Modulation:
          <b
            >${this.editorContent.scheme}${V(this.editorContent.scheme).hasStereo()?this.editorContent.stereo?" Stereo":" Mono":m}</b
          >${V(this.editorContent.scheme).hasBandwidth()?u`, Bandwidth:
                <b>${yi(this.editorContent.bandwidth,1)}</b>`:m}
        </div>
        <div>
          Gain:
          <b
            >${this.editorContent.gain===null?"Auto":this.editorContent.gain}</b
          >${V(this.editorContent.scheme).hasSquelch()?u`, Squelch: <b>${this.editorContent.squelch}</b>`:m}
        </div>
        ${this.editorIndex!==void 0?u`<div>
              <button @click=${this.onEditorReplaceClick}>
                Replace with current settings
              </button>
            </div>`:m}
        <div>
          <button
            .disabled=${this.editorValidationError!==void 0}
            @click=${this.onEditorSaveClick}
          >
            Save</button
          >${this.editorValidationError!==void 0?u` <i>${this.editorValidationError}</i>`:m}
        </div>
      </rr-window>`}willUpdate(t){super.willUpdate(t),(t.has("presets")||t.has("sortColumn"))&&this.updatePresetLists(),this.findSelectedIndex()}updatePresetLists(){let t=[...this.presets.keys()];t.sort(this.getSortFormula()),this.sortedIndices=t}onAddClick(t){this.editorTitle="New Preset",this.editorIndex=void 0,this.editorContent={name:"",tunedFrequency:this.tunedFrequency,scale:this.scale,tuningStep:this.tuningStep,scheme:this.scheme,bandwidth:this.bandwidth,stereo:this.stereo,squelch:this.squelch,gain:this.gain},this.checkValidEditor(),this.editorOpen=!0}onEditorNameKeydown(t){t.key=="Enter"?(t.preventDefault(),this.onEditorSaveClick()):t.key=="Escape"&&(t.preventDefault(),this.onEditorClosed())}onEditorNameChange(t){let i=t.target.value;this.editorContent.name=i,this.checkValidEditor()}onEditorReplaceClick(){this.editorContent={name:this.editorContent.name,tunedFrequency:this.tunedFrequency,scale:this.scale,tuningStep:this.tuningStep,scheme:this.scheme,bandwidth:this.bandwidth,stereo:this.stereo,squelch:this.squelch,gain:this.gain},this.checkValidEditor()}checkValidEditor(){if(this.editorContent.name==""){this.editorValidationError="Preset name is empty";return}let t=this.presets.findIndex(e=>e.name==this.editorContent.name);if(t>=0&&t!=this.editorIndex){this.editorValidationError="There is another preset with that name";return}if(t=this.presets.findIndex(e=>fo(e,this.editorContent)),t>=0&&t!=this.editorIndex){this.editorValidationError=`There is an identical preset: ${this.presets[t].name}`;return}this.editorValidationError=void 0}onEditorSaveClick(){let t=[...this.presets];this.editorIndex===void 0||this.editorIndex>=t.length?t.push({...this.editorContent}):t[this.editorIndex]={...this.editorContent},this.editorOpen=!1,this.presets=t,this.dispatchEvent(new vi)}onEditorOpen(){this.presetName&&this.presetName.focus()}onEditorClosed(){this.editorOpen=!1}onRowClick(t){let e=this.getIndex(t);e!==void 0&&(this.selectedIndex=e,this.dispatchEvent(new vs))}onRowEditClick(t){t.stopPropagation();let e=this.getIndex(t);if(e===void 0)return;let i={...this.presets[e]};this.editorTitle=`Editing Preset "${i.name}"`,this.editorIndex=e,this.editorContent=i,this.checkValidEditor(),this.editorOpen=!0}onRowDeleteClick(t){t.stopPropagation();let e=this.getIndex(t);if(e===void 0)return;let i=[...this.presets];i.splice(e,1),this.selectedIndex=void 0,this.presets=i,this.dispatchEvent(new vi)}getIndex(t){let e=t.target;for(;e!=null&&e.tagName!="TR";)e=e.parentElement;if(e==null)return;let i=Number(e.dataset.index);if(!isNaN(i))return i}onHeaderClick(t){let e=t.currentTarget.id,i=`-${e}`;this.sortColumn===e?this.sortColumn=i:this.sortColumn=e,this.dispatchEvent(new ws)}getSortArrow(t){return this.sortColumn===t?zr:this.sortColumn===`-${t}`?Ar:m}getSortFormula(){let t=this.sortColumn||"frequency",e=t[0]=="-";e&&(t=t.substring(1));let i;switch(t){case"name":i=(s,o)=>this.presets[s].name.localeCompare(this.presets[o].name);break;case"mode":i=(s,o)=>this.presets[s].scheme.localeCompare(this.presets[o].scheme);break;default:i=(s,o)=>this.presets[s].tunedFrequency-this.presets[o].tunedFrequency;break}return e?(s,o)=>i(o,s):i}findSelectedIndex(){let t=this.presets.findIndex(e=>fo(e,this));t<0?this.selectedIndex=void 0:this.selectedIndex=t}};D([h({attribute:!1}),E("design:type",Boolean)],$.prototype,"inline",void 0);D([h({attribute:!1}),E("design:type",Boolean)],$.prototype,"hidden",void 0);D([h({attribute:!1}),E("design:type",Number)],$.prototype,"tunedFrequency",void 0);D([h({attribute:!1}),E("design:type",Number)],$.prototype,"scale",void 0);D([h({attribute:!1}),E("design:type",Number)],$.prototype,"tuningStep",void 0);D([h({attribute:!1}),E("design:type",String)],$.prototype,"scheme",void 0);D([h({attribute:!1}),E("design:type",Number)],$.prototype,"bandwidth",void 0);D([h({attribute:!1}),E("design:type",Boolean)],$.prototype,"stereo",void 0);D([h({attribute:!1}),E("design:type",Number)],$.prototype,"squelch",void 0);D([h({attribute:!1}),E("design:type",Object)],$.prototype,"gain",void 0);D([h({attribute:!1}),E("design:type",Number)],$.prototype,"selectedIndex",void 0);D([h({attribute:!1}),E("design:type",String)],$.prototype,"sortColumn",void 0);D([h({attribute:!1}),E("design:type",Array)],$.prototype,"presets",void 0);D([Z(),E("design:type",Array)],$.prototype,"sortedIndices",void 0);D([Z(),E("design:type",String)],$.prototype,"editorTitle",void 0);D([Z(),E("design:type",Boolean)],$.prototype,"editorOpen",void 0);D([Z(),E("design:type",Number)],$.prototype,"editorIndex",void 0);D([Z(),E("design:type",String)],$.prototype,"editorValidationError",void 0);D([Z(),E("design:type",Object)],$.prototype,"editorContent",void 0);D([w("#presets"),E("design:type",typeof(po=typeof M<"u"&&M)=="function"?po:Object)],$.prototype,"window",void 0);D([w("#presetName"),E("design:type",typeof(uo=typeof HTMLInputElement<"u"&&HTMLInputElement)=="function"?uo:Object)],$.prototype,"presetName",void 0);$=D([y("rr-presets")],$);var vs=class extends Event{constructor(){super("rr-preset-selected",{bubbles:!0,composed:!0})}},vi=class extends Event{constructor(){super("rr-presets-changed",{bubbles:!0,composed:!0})}},ws=class extends Event{constructor(){super("rr-presets-sorted",{bubbles:!0,composed:!0})}};function fo(r,t){return r.tunedFrequency===t.tunedFrequency&&r.scale===t.scale&&r.tuningStep===t.tuningStep&&r.bandwidth===t.bandwidth&&r.stereo===t.stereo&&r.squelch===t.squelch&&r.gain===t.gain}function yi(r,t){switch(t){case 1e3:return`${String(r/1e3)} kHz`;case 1e6:return`${String(r/1e6)} MHz`;default:return`${String(r)} Hz`}}var at=function(r,t,e,i){var s=arguments.length,o=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(n=r[a])&&(o=(s<3?n(o):s>3?n(t,e,o):n(t,e))||o);return s>3&&o&&Object.defineProperty(t,e,o),o},pt=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},mo,Yo=(()=>{let r=new Set([256e3]);for(let e=1024e3;e<3e6;e+=256e3)r.add(e);for(let e=96e4;e<3e6;e+=192e3)r.add(e);let t=[...r];return t.sort((e,i)=>Number(e)-Number(i)),t})(),Go=(()=>{let r=new Array;for(let t=32;t<=32768;t*=2)r.push(t);return r})(),Xo=new Map([["default","Default method"],["directSampling","Direct sampling"],["upconverter","External upconverter"]]),Ko=new Map([["Q","Q"],["I","I"]]),Jo=new Map([[50,"Europe"],[75,"USA"]]),tn=new Map([["cpu","Use more CPU"],["latency","Have more latency"],["quality","Have worse quality"]]),it=class extends Jt(g){constructor(){super(...arguments),this.inline=!1,this.playing=!1,this.sampleRate=1024e3,this.ppm=0,this.fftSize=2048,this.fmDeemph=50,this.biasTee=!1,this.lowFrequencyMethod={name:"default",channel:"Q",frequency:1e8,biasTee:!1},this.performanceTradeoff="cpu"}static get styles(){return[et]}render(){return u`<rr-window
      label="Settings"
      id="settings"
      closeable
      class=${this.inline?"inline":""}
      .position=${this.position}
      .fixed=${this.inline}
    >
      <div>
        <label for="sampleRate">Sample rate: </label
        ><select
          id="sampleRate"
          .disabled=${this.playing}
          @change=${this.onSampleRateChange}
        >
          ${Yo.map(t=>u`<option value=${t} .selected=${this.sampleRate==t}>
                ${t}
              </option>`)}
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
          ${Go.map(t=>u`<option value=${t} .selected=${this.fftSize==t}>
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
          ${Jo.entries().map(t=>u`<option value=${t[0]} .selected=${this.fmDeemph==t[0]}>
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
      <div>
        <label for="lowFreqMethod">0-29MHz method: </label
        ><select id="lowFreqMethod" @change=${this.onLowFrequencyMethodChange}>
          ${Xo.entries().map(([t,e])=>u`<option
                value=${String(t)}
                .selected=${this.lowFrequencyMethod.name==t}
              >
                ${e}
              </option>`)}
        </select>
      </div>
      <div .hidden=${this.lowFrequencyMethod.name!="directSampling"}>
        <label for="directSamplingChannel">Direct sampling channel: </label
        ><select
          id="directSamplingChannel"
          @change=${this.onDirectSamplingChannelChange}
        >
          ${Ko.entries().map(([t,e])=>u`<option
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
          ${tn.entries().map(t=>u`<option
                value=${t[0]}
                .selected=${this.performanceTradeoff==t[0]}
              >
                ${t[1]}
              </option>`)}
        </select>
      </div>
    </rr-window>`}onSampleRateChange(t){this.sampleRate=Number(t.target.selectedOptions[0].value),this.dispatchEvent(new xs)}onPpmChange(t){let e=t.target,i=Number(e.value);if(isNaN(i)){e.value=String(this.ppm);return}this.ppm=i,this.dispatchEvent(new Ss)}onFftSizeChange(t){this.fftSize=Number(t.target.selectedOptions[0].value),this.dispatchEvent(new $s)}onFmDeemphChange(t){this.fmDeemph=Number(t.target.selectedOptions[0].value),this.dispatchEvent(new Ds)}onBiasTeeChange(t){this.biasTee=t.target.checked,this.dispatchEvent(new Cs)}onLowFrequencyMethodChange(t){let e={...this.lowFrequencyMethod};e.name=t.target.selectedOptions[0].value,this.lowFrequencyMethod=e,this.dispatchEvent(new ie)}onDirectSamplingChannelChange(t){let e={...this.lowFrequencyMethod};e.channel=t.target.selectedOptions[0].value,this.lowFrequencyMethod=e,this.dispatchEvent(new ie)}onUpconverterFrequencyChange(t){let e=t.target,i=Number(e.value);if(isNaN(i)){e.value=String(this.lowFrequencyMethod.frequency);return}let s={...this.lowFrequencyMethod};s.frequency=i,this.lowFrequencyMethod=s,this.dispatchEvent(new ie)}onUpconverterBiasTeeChange(t){let e={...this.lowFrequencyMethod};e.biasTee=t.target.checked,this.lowFrequencyMethod=e,this.dispatchEvent(new ie)}onPerformanceTradeoffChange(t){this.performanceTradeoff=t.target.selectedOptions[0].value,this.dispatchEvent(new Ms)}};at([h({attribute:!1}),pt("design:type",Boolean)],it.prototype,"inline",void 0);at([h({attribute:!1}),pt("design:type",Boolean)],it.prototype,"playing",void 0);at([h({attribute:!1}),pt("design:type",Number)],it.prototype,"sampleRate",void 0);at([h({attribute:!1}),pt("design:type",Number)],it.prototype,"ppm",void 0);at([h({attribute:!1}),pt("design:type",Number)],it.prototype,"fftSize",void 0);at([h({attribute:!1}),pt("design:type",Number)],it.prototype,"fmDeemph",void 0);at([h({attribute:!1}),pt("design:type",Boolean)],it.prototype,"biasTee",void 0);at([h({attribute:!1}),pt("design:type",Object)],it.prototype,"lowFrequencyMethod",void 0);at([h({attribute:!1}),pt("design:type",String)],it.prototype,"performanceTradeoff",void 0);at([w("rr-window"),pt("design:type",typeof(mo=typeof M<"u"&&M)=="function"?mo:Object)],it.prototype,"window",void 0);it=at([y("rr-settings")],it);var xs=class extends Event{constructor(){super("rr-sample-rate-changed",{bubbles:!0,composed:!0})}},Ss=class extends Event{constructor(){super("rr-ppm-changed",{bubbles:!0,composed:!0})}},$s=class extends Event{constructor(){super("rr-fft-size-changed",{bubbles:!0,composed:!0})}},Ds=class extends Event{constructor(){super("rr-fm-deemph-changed",{bubbles:!0,composed:!0})}},Cs=class extends Event{constructor(){super("rr-bias-tee-changed",{bubbles:!0,composed:!0})}},ie=class extends Event{constructor(){super("rr-low-frequency-method-changed",{bubbles:!0,composed:!0})}},Ms=class extends Event{constructor(){super("rr-performance-tradeoff-changed",{bubbles:!0,composed:!0})}};var q=function(r,t,e,i){var s=arguments.length,o=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(r,t,e,i);else for(var a=r.length-1;a>=0;a--)(n=r[a])&&(o=(s<3?n(o):s>3?n(t,e,o):n(t,e))||o);return s>3&&o&&Object.defineProperty(t,e,o),o},St=function(r,t){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(r,t)},go,bo,yo,vo,se=class extends g{connectedCallback(){super.connectedCallback(),this.observer?.disconnect(),this.observer=new IntersectionObserver(t=>this.onVisible(t),{threshold:[.05,.1]}),this.observer.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.observer?.disconnect(),this.observer=void 0}onVisible(t){t[0].intersectionRatio>.09?this.player===void 0&&(this.player=$o.subscribe(e=>this.addSpectrum(e))):t[0].intersectionRatio<=.05&&this.player!==void 0&&($o.unsubscribe(this.player),this.player=void 0)}},Ps=class extends se{static get styles(){return[b`
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
      `]}render(){return u`<div id="container">
      <rr-spectrum
        id="spectrum"
        .centerFrequency=${939e5}
        .bandwidth=${1e6}
        .frequencyScale=${1e6}
      ></rr-spectrum>
    </div>`}addSpectrum(t){this.spectrumView?.addFloatSpectrum(939e5,t)}};q([w("#spectrum"),St("design:type",typeof(go=typeof C<"u"&&C)=="function"?go:Object)],Ps.prototype,"spectrumView",void 0);Ps=q([y("rr-demo-spectrum")],Ps);var Es=class extends se{static get styles(){return[b`
        #container {
          position: relative;
          width: 100%;
          aspect-ratio: 5/1;
        }

        rr-scope {
          height: 100%;
        }
      `]}render(){return u`<div id="container">
      <rr-scope
        id="scope"
        .centerFrequency=${939e5}
        .bandwidth=${1e6}
        .frequencyScale=${1e6}
      ></rr-scope>
    </div>`}addSpectrum(t){this.scopeView?.addFloatSpectrum(t)}};q([w("#scope"),St("design:type",typeof(bo=typeof k<"u"&&k)=="function"?bo:Object)],Es.prototype,"scopeView",void 0);Es=q([y("rr-demo-scope")],Es);var _s=class extends se{static get styles(){return[b`
        #container {
          position: relative;
          width: 100%;
          aspect-ratio: 5/1;
          background-color: black;
        }

        rr-waterfall {
          height: 100%;
        }
      `]}render(){return u`<div id="container">
      <rr-waterfall id="waterfall"></rr-waterfall>
    </div>`}addSpectrum(t){this.waterfallView?.addFloatSpectrum(939e5,t)}};q([w("#waterfall"),St("design:type",typeof(yo=typeof H<"u"&&H)=="function"?yo:Object)],_s.prototype,"waterfallView",void 0);_s=q([y("rr-demo-waterfall")],_s);var wo=class extends g{static get styles(){return[b`
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
      `]}render(){return u` <div id="controls">
      <rr-decibel-range></rr-decibel-range>
      <div id="zoomControls">
        <rr-zoombar></rr-zoombar>
        <rr-scrollbar></rr-scrollbar>
      </div>
    </div>`}};wo=q([y("rr-demo-bottombar")],wo);var wi=class extends g{constructor(){super(...arguments),this.scheme="WBFM",this.mode=Le(this.scheme)}static get styles(){return[b`
        :host {
          display: block;
        }

        #container {
          position: relative;
        }

        rr-main-controls {
          height: 100%;
        }
      `]}render(){return u`<div id="container">
      <rr-main-controls
        id="controls"
        .inline=${!0}
        .showHelp=${!1}
        .centerFrequency=${939e5}
        .frequencyScale=${1e6}
        .scheme=${this.mode.scheme}
        .bandwidth=${V(this.mode).getBandwidth()}
        .stereo=${V(this.mode).getStereo()}
        .stereoStatus=${!0}
        .squelch=${V(this.mode).getSquelch()}
        @rr-scheme-changed=${this.onSchemeChanged}
      ></rr-main-controls>
    </div>`}onSchemeChanged(t){this.scheme=t.target.scheme}willUpdate(t){t.has("scheme")&&(this.mode=Le(this.scheme))}};q([h({type:String,reflect:!0}),St("design:type",String)],wi.prototype,"scheme",void 0);q([Z(),St("design:type",Object)],wi.prototype,"mode",void 0);wi=q([y("rr-demo-controls")],wi);var xo=class extends g{static get styles(){return[b`
        :host {
          display: block;
        }

        #container {
          position: relative;
        }

        rr-settings {
          height: 100%;
        }
      `]}render(){return u`<div id="container">
      <rr-settings id="settings" .inline=${!0}></rr-settings>
    </div>`}};xo=q([y("rr-demo-settings")],xo);var So=class extends g{static get styles(){return[b`
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
      `]}render(){return u`<div id="container">
      <rr-presets
        id="presets"
        .inline=${!0}
        .presets=${[{name:"Rock & Roll FM station",tunedFrequency:897e5,scale:1e6,tuningStep:1e5,scheme:"WBFM",bandwidth:15e4,stereo:!0,squelch:0,gain:30},{name:"Talk Radio AM",tunedFrequency:12e5,scale:1e3,tuningStep:1e4,scheme:"AM",bandwidth:1e4,stereo:!1,squelch:0,gain:30},{name:"Frequency standard",tunedFrequency:1e7,scale:1,tuningStep:1e4,scheme:"AM",bandwidth:1e4,stereo:!1,squelch:0,gain:30},{name:"Ham radio net",tunedFrequency:143e5,scale:1e3,tuningStep:1e3,scheme:"USB",bandwidth:2800,stereo:!1,squelch:0,gain:30}]}
      ></rr-presets>
    </div>`}};So=q([y("rr-demo-presets")],So);var Do=new Map([["play",ii],["stop",ei],["add",Se],["edit",li],["delete",hi],["presets",ci],["settings",si],["zoom-in",ni],["zoom-out",ai],["scroll-left",ri],["scroll-right",oi]]),As=class extends g{constructor(){super(...arguments),this.name="play"}static get styles(){return[b`
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
      `]}render(){return u`<button>${Do.get(this.name)}</button>`}};q([h({type:String,reflect:!0}),St("design:type",String)],As.prototype,"name",void 0);As=q([y("rr-demo-button")],As);var zs=class extends g{constructor(){super(...arguments),this.name="play"}static get styles(){return[b`
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
      `]}render(){return u`${Do.get(this.name)}`}};q([h({type:String,reflect:!0}),St("design:type",String)],zs.prototype,"name",void 0);zs=q([y("rr-demo-icon")],zs);var xi=class extends se{constructor(){super(...arguments),this.highlight={point:.5,band:{left:.5-.035,right:.5+.035}}}static get styles(){return[b`
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
      `]}render(){return u`<div id="container">
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
    </div>`}addSpectrum(t){this.spectrumView?.addFloatSpectrum(939e5,t)}};q([Z(),St("design:type",Object)],xi.prototype,"highlight",void 0);q([w("#spectrum"),St("design:type",typeof(vo=typeof C<"u"&&C)=="function"?vo:Object)],xi.prototype,"spectrumView",void 0);xi=q([y("rr-demo-highlight")],xi);var ut=class{constructor(t,e,i){this.fraction=t,this.width=e,this.pulses=i,this.sample=0}add(t){let e=t.length,i=0;for(let s=0;s<this.pulses.length;++s){let{max:o,period:n,phase:a}=this.pulses[s],l=a+2*Math.PI*this.sample/n;i+=o*(Math.cos(l)+1)/2}for(let s=0;s<e;++s){let o=s/e+.5;o>1&&(o-=1);let n=this.fraction-o,a=1-n*n/this.width;t[s]=t[s]+Math.max(0,a*i)}this.sample+=1}};function _e(r,t,e){for(let i=0;i<r.length;i+=e){let s=t*Math.random();for(let o=0;o<e;++o)r[i+o]+=s}}var Fs=class{constructor(t){this.generators=t,this.spectrumAdders=[],this.playing=!1,this.spectrum=new Float32Array(2048)}subscribe(t){let e=this.spectrumAdders.push(t);return this.play(),e-1}unsubscribe(t){if(!(t>=this.spectrumAdders.length))for(this.spectrumAdders[t]=null;this.spectrumAdders.length>0&&this.spectrumAdders[this.spectrumAdders.length-1]==null;)this.spectrumAdders.pop()}play(){this.playing||(this.playing=!0,requestAnimationFrame(t=>this.frame(t,0)))}stop(){this.playing=!1}frame(t,e){if(this.spectrumAdders.length==0&&(this.playing=!1),!this.playing)return;let s=Math.floor(20*t/1e3);if(s>e){this.spectrum.fill(-105),_e(this.spectrum,8,1),_e(this.spectrum,6,2),_e(this.spectrum,4,4),_e(this.spectrum,2,8),_e(this.spectrum,1,16);for(let o of this.generators)o.add(this.spectrum);for(let o of this.spectrumAdders)o?.(this.spectrum)}requestAnimationFrame(o=>this.frame(o,s))}};function en(){return[new ut(.1,.001,[{max:20,period:10,phase:1},{max:10,period:7,phase:2},{max:7,period:3.2,phase:3}]),new ut(.1,1e-4,[{max:10,period:10,phase:1},{max:5,period:7,phase:2},{max:3.5,period:3.2,phase:3}]),new ut(.5,.001,[{max:13,period:9,phase:4},{max:15,period:11,phase:5},{max:4,period:4,phase:6},{max:4,period:7,phase:7}]),new ut(.5,1e-4,[{max:9,period:9,phase:4},{max:10,period:11,phase:5},{max:3,period:4,phase:6},{max:3,period:7,phase:7}]),new ut(.7,.001,[{max:4,period:6,phase:8},{max:5,period:10,phase:9},{max:3,period:4,phase:10}]),new ut(.7,1e-4,[{max:2,period:6,phase:8},{max:2.5,period:10,phase:9},{max:1.5,period:4,phase:10}]),new ut(.9,.001,[{max:12,period:7,phase:11},{max:17,period:12,phase:12},{max:8,period:5,phase:13}]),new ut(.9,1e-4,[{max:6,period:7,phase:11},{max:8,period:12,phase:12},{max:4,period:5,phase:13}])]}var $o=new Fs(en());function sn(){let r=0,t=document.createElement("UL"),e=document.body.firstElementChild;for(;e!=null;){let i=e.tagName=="H1"?1:e.tagName=="H2"?2:0;if(i>0&&!e.classList.contains("title")){if(r>0&&i>r){let o=document.createElement("UL");t.lastElementChild?.append(o),t=o}else i<r&&(t=t.parentElement);let s=document.createElement("LI");if(e.id){let o=document.createElement("A");o.textContent=e.textContent,o.href="#"+e.id,s.append(o)}else s.textContent=e.textContent;t.appendChild(s),r=i}e=e.nextElementSibling}for(;t.parentElement!=null;)t=t.parentElement;t.hasChildNodes()&&document.getElementById("toc")?.append(t)}window.addEventListener("load",sn);})();
/*! Bundled license information:

@lit/reactive-element/css-tag.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/reactive-element.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/lit-html.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-element/lit-element.js:
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

@lit/reactive-element/decorators/custom-element.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/property.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/state.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/event-options.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/base.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-all.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-async.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-assigned-elements.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-assigned-nodes.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/
