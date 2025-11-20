/*
核心逻辑：幽灵交互动画类（无 UI 框架依赖）。
说明：
- 该类期望接收一个包含完整模板结构的 scene 根节点。
- 所有尺寸与定位限定在传入的 parent 容器内，不会写入 body。
*/
export default class Ghost {
  constructor(el, options = {}) {
    this.scene = el;
    this.parent = options.parent || el?.parentElement || document.body;
    this.clone = el.cloneNode(true);
    this.isEscaping = false;

    this.ghost = el.querySelector('.ghost');
    this.face = el.querySelector('.ghost-face');
    this.eyes = el.querySelector('.eyes-row');
    this.leftEye = this.eyes.querySelector('.left');
    this.rightEye = this.eyes.querySelector('.right');
    this.mouth = el.querySelector('.mouth');
    this.mouthState = 'neutral';
    this.shadow = el.querySelector('.shadow-container');
    this.leftCheek = el.querySelector('.left.cheek');
    this.rightCheek = el.querySelector('.right.cheek');
    this.leftHand = el.querySelector('.hand-left');
    this.rightHand = el.querySelector('.hand-right');
    this.activityInterval = null;
  }

  reset() {
    // 清空旧 scene，克隆初始模板
    if (this.scene && this.scene.remove) this.scene.remove();
    this.scene = this.clone.cloneNode(true);
    this.scene.style.position = 'absolute';
    this.parent.append(this.scene);
    this.resetRefs();

  this.scene.classList.remove('stars-out');
  this.scene.classList.remove('move-stars-out');
  this.scene.classList.remove('portal-open');
  this.scene.classList.remove('emerging');
  this.scene.classList.remove('into-hole');
  this.scene.classList.remove('stars-to-hole');
  this.scene.classList.remove('portal-close');
  this.scene.classList.remove('portal-shrink');
  this.scene.classList.add('portal-emerge');

    const containerW = this.parent.clientWidth || this.parent.getBoundingClientRect().width;
    const containerH = this.parent.clientHeight || this.parent.getBoundingClientRect().height;
    const sceneW = this.scene.offsetWidth || 140;
    const sceneH = this.scene.offsetHeight || 160;

    const maxLeft = Math.max(0, Math.floor(containerW - sceneW));
    const maxTop = Math.max(0, Math.floor(containerH - sceneH));
    this.scene.style.left = Math.floor(Math.random() * (maxLeft + 1)) + 'px';
    this.scene.style.top = Math.floor(Math.random() * (maxTop + 1)) + 'px';

    // 初始：黑洞处于细线，稍后展开
    if (this.shadow) this.shadow.classList.remove('disappear');

    this.enter();
  }

  resetRefs() {
    this.ghost = this.scene.querySelector('.ghost');
    this.face = this.scene.querySelector('.ghost-face');
    this.eyes = this.scene.querySelector('.eyes-row');
    this.leftEye = this.eyes.querySelector('.left');
    this.rightEye = this.eyes.querySelector('.right');
    this.mouth = this.scene.querySelector('.mouth');
    this.mouthState = 'neutral';
    this.isEscaping = false;
    this.shadow = this.scene.querySelector('.shadow-container');
    this.leftCheek = this.scene.querySelector('.left.cheek');
    this.rightCheek = this.scene.querySelector('.right.cheek');
    this.leftHand = this.scene.querySelector('.hand-left');
    this.rightHand = this.scene.querySelector('.hand-right');
  }

  // 眨眼睛
  blink() {
    this.leftEye.classList.add('blink');
    this.rightEye.classList.add('blink');
    setTimeout(() => {
      this.leftEye.classList.remove('blink');
      this.rightEye.classList.remove('blink');
    }, 50);
  }

  // 挥手动作
  wave() {
    this.leftHand.classList.add('waving');
    setTimeout(() => {
      this.leftHand.classList.remove('waving');
    }, 500);
  }

  // 嘴
  openMouth() {
    this.mouth.classList.remove('closed');
    this.mouth.classList.add('open');
    this.mouthState = 'open';
  }

  closeMouth() {
    this.mouth.classList.remove('open');
    this.mouth.classList.add('closed');
    this.mouthState = 'closed';
  }

  neutralMouth() {
    this.mouth.classList.remove('open');
    this.mouth.classList.remove('closed');
    this.mouthState = 'neutral';
  }

  // 鼠标放上时的状态
  hover() {
    this.ghost.classList.add('hover');
  }

  surprise() {
    this.face.classList.add('surprised');
  }

  // 逃离状态
  runAway() {
    clearInterval(this.activityInterval);
    if (!this.isEscaping) {
      this.isEscaping = true;
      // 准备收束：星星向黑洞汇聚，幽灵下潜到黑洞中
  this.scene.classList.remove('emerging');
  // 先移除展开态，避免高特异性规则覆盖收缩样式
  this.scene.classList.remove('portal-open');
  this.scene.classList.remove('portal-emerge');
  // 渐收阶段（1 -> 0.35）
  this.scene.classList.add('portal-shrink');
  this.scene.classList.add('into-hole', 'stars-to-hole', 'move-stars-in');
  this.scene.classList.remove('stars-out');

      // 等待幽灵与星星进入洞中
      setTimeout(() => {
        // 切换到最终收缩（0.35 -> 0）
        this.scene.classList.remove('portal-shrink');
        this.scene.classList.add('portal-close');
        // 再等待黑洞关闭完毕，开始在新位置重置并重新出现
        setTimeout(() => {
          this.reset();
        }, 380);
      }, 820);
    }
  }

  // 回来时状态
  enter() {
    // 1) 打开黑洞
    setTimeout(() => {
      this.scene.classList.add('portal-open');
    }, 30);

    // 2) 幽灵出洞 + 星星外放
    setTimeout(() => {
      this.scene.classList.add('emerging');
      this.scene.classList.add('stars-out', 'move-stars-out');
    }, 420);

    // 3) 进入待机（悬浮/眨眼等）
    setTimeout(() => {
      this.hover();
      this.prepareEscape();
      this.startActivity();
    }, 1400);
  }

  startActivity() {
    this.activityInterval = setInterval(() => {
      switch (Math.floor(Math.random() * 4)) {
        case 0:
          this.blink();
          setTimeout(() => { this.blink(); }, 400);
          setTimeout(() => { this.blink(); }, 1300);
          break;
        case 1:
          this.wave();
          break;
        default:
          break;
      }
    }, 7000);
  }

  prepareEscape() {
    this.scene.addEventListener('click', () => { this.runAway(); }, false);
    this.scene.addEventListener('mouseover', () => { this.runAway(); }, false);
    this.scene.addEventListener('focus', () => { this.runAway(); }, false);
  }
}
