import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Ticker } from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import '../../../styles/home/maidstyle/Maid.css';

// 将 Pixi 的 Ticker 注册给 Live2D，让 Live2D 的更新与 Pixi 的主循环同步
/*Pixi 的 Ticker 是一个基于 requestAnimationFrame 的“主循环驱动器”；
把 Live2D 绑定到这个驱动器上，
就能让模型的动画更新和场景渲染在同一帧节奏里运行，
保持一致的帧率、暂停/继续一致、性能也更可控
*/
Live2DModel.registerTicker(Ticker);

export default function Maid() {
	const containerRef = useRef(null);
	const appRef = useRef(null);
	const modelRef = useRef(null);
	// 缓存已加载的模型：key 为路径，value 为 Live2DModel 实例
	const preloadedRef = useRef(new Map());
	const [collapsed, setCollapsed] = useState(false);
	const [modelIndex, setModelIndex] = useState(0);
	const [modelPaths, setModelPaths] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	// 用户可调的清晰度（渲染分辨率倍率）。默认取设备像素比，最高 2x 以兼顾性能
	const [dpi, setDpi] = useState(3);
	// 用户可调的模型大小倍率（在 contain 结果基础上再缩放，不会超过容器）
	const [userScale, setUserScale] = useState(1);
	// 设置面板开关
	const [settingsOpen, setSettingsOpen] = useState(false);

	// 运行时选择的表情（仅用于当前模型；现阶段仅 applefox 在底部控制条提供入口）
	const [selectedExpression, setSelectedExpression] = useState('');
	// 表情面板：点击图标展开/收起（无悬停行为）
	const [emotionOpen, setEmotionOpen] = useState(false);
	// 动作选择分组（动作已合并进表情面板，不再单独控件）
	const [activeMotionGroup, setActiveMotionGroup] = useState('');

	// 便捷读取：当前模型的动作分组与表情列表
	const getCurrentSettings = () => {
		const m = modelRef.current;
		const settings = m?.internalModel?.settings || m?.internalModel?._settings;
		return settings || {};
	};

	const getExpressions = () => {
		const settings = getCurrentSettings();
		const expressions = settings?.expressions || settings?.Expressions || settings?._expressions || [];
		const isChinese = (s = '') => /[\u4e00-\u9fa5]/.test(s);
		const tokenMap = new Map([
			// 常见情绪/表情
			['xingxingyan','星星眼'], ['xingxing','星星'], ['aixinyan','爱心眼'], ['xinxinyan','心心眼'], ['xinxin','心心'],
			['lianhong','脸红'], ['heilian','黑脸'], ['yanlei','眼泪'], ['liuhan','流汗'], ['shengqi','生气'],
			['wenhao','问号'], ['wenhao2','问号2'], ['wuyu','无语'], ['qianyan','浅眼'], ['lunhuiyan','轮回眼'],
			['kongbaiyan','空白眼'], ['tushe','吐舌'], ['duzui','嘟嘴'], ['guzui','鼓嘴'], ['changfa','长发'],
			['shuangmawei','双马尾'], ['chuier','吹耳'], ['jingzi','镜子'], ['huli','狐狸'], ['baohuli','抱狐狸'],
			['bijiben','笔记本'], ['bijiben2','笔记本2'], ['dayouxi','打游戏'], ['shanzi','扇子'], ['bixin','比心'],
			// 英文常见
			['cry','哭泣'], ['ft','福特/特效'], ['hat','帽子'], ['hairbun','丸子头'], ['pillow','抱枕'],
			['facehand','手挡脸'],
		]);
		const deriveCN = (name = '', file = '') => {
			if (isChinese(name) && name.trim()) return name.trim();
			const f = (file || '').toLowerCase().replace(/\\/g,'/');
			const base = f.split('/').pop() || '';
			const stem = base.replace(/\.exp3?\.json$/i,'').replace(/[^a-z0-9\u4e00-\u9fa5]+/gi,'');
			if (!stem) return name || base || '表情';
			// 直接命中
			if (tokenMap.has(stem)) return tokenMap.get(stem);
			// 组合命中（按包含关系）
			for (const [k, v] of tokenMap.entries()) {
				if (stem.includes(k)) return v;
			}
			// 大写英文词
			if (/^[a-z]+$/i.test(stem)) return stem.toUpperCase();
			return name || stem;
		};
		// 统一为 {name, file, displayName}
		return (expressions || []).map((e, i) => {
			const name = e?.Name || e?.name || `exp-${i}`;
			const file = e?.File || e?.file || '';
			const displayName = deriveCN(name, file);
			return { name, file, displayName };
		});
	};

	const getMotions = () => {
		const settings = getCurrentSettings();
		const motions = settings?.motions || settings?.Motions || settings?._motions || {};
		// 返回 { groupName: string, items: Array<{file: string, name?: string, sound?: string}> }
		const groups = Object.keys(motions || {});
		return groups.map((g) => ({
			groupName: g,
			items: (motions[g] || []).map((m, i) => ({
				file: m?.File || m?.file || '',
				name: m?.Name || m?.name || `${g}-${i}`,
				sound: m?.Sound || m?.sound || '',
			})),
		}));
	};

	// 尝试为模型启动待机动画（Idle/待机/待机动画 等常见分组）
	const startIdle = async (model) => {
		if (!model) return;
		const preferred = ['Idle', 'idle', 'IDLE', '待机', '待机动画', '待機'];
		let groups = [];
		try {
			const settings = model?.internalModel?.settings || model?.internalModel?._settings;
			const motions = settings?.motions || settings?.Motions || settings?._motions;
			if (motions && typeof motions === 'object') groups = Object.keys(motions);
		} catch {
			// 忽略读取失败
		}
		const group = preferred.find((g) => groups.includes(g)) || groups[0];
		if (!group) return;
		try {
			// v0.4.0 的正确用法：直接调用 model.motion(group)
			await model.motion(group);
		} catch (e) {
			console.warn('启动待机动画失败', e);
		}
	};

	// 拖拽相关
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		// 扩大可拖拽范围：画布区域 + 控制条背景（设置面板不参与拖拽）
		const handleCanvas = el.querySelector('.maid-canvas-wrap');
		const handleBar = el.querySelector('.maid-controlbar');
		const handleEls = [handleCanvas, handleBar].filter(Boolean);

		let dragging = false;
		let startX = 0;
		let startY = 0;
		let startLeft = 0;
		let startTop = 0;

		const onPointerDown = (e) => {
			// 在控制条上仅当不是与控件交互时才允许拖拽
			if (e.target && typeof e.target.closest === 'function') {
				const inBar = e.target.closest('.maid-controlbar');
				const inSettings = e.target.closest('.maid-settings-panel');
				if (inBar || inSettings) {
					const interactive = e.target.closest('select, input, button');
					if (interactive) return;
				}
			}
			// 尽量捕获指针，避免在窗口外松手导致无法收到 pointerup
			if (typeof e.target.setPointerCapture === 'function' && e.pointerId != null) {
				e.target.setPointerCapture(e.pointerId);
			}
			dragging = true;
			const rect = el.getBoundingClientRect();
			startLeft = rect.left;
			startTop = rect.top;
			startX = e.clientX;
			startY = e.clientY;
			el.classList.add('maid-dragging');
		};

		const onPointerMove = (e) => {
			if (!dragging) return;
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			const newLeft = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, startLeft + dx));
			const newTop = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, startTop + dy));
			el.style.left = `${newLeft}px`;
			el.style.top = `${newTop}px`;
			el.style.right = 'auto';
			el.style.bottom = 'auto';
		};

		const onPointerUp = () => {
			dragging = false;
			el.classList.remove('maid-dragging');
		};

		handleEls.forEach((h) => h.addEventListener('pointerdown', onPointerDown));
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);

		return () => {
			handleEls.forEach((h) => h.removeEventListener('pointerdown', onPointerDown));
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
		};
	}, []);

	// 根据容器与当前倍率，对模型进行自适应摆放（contain + 左上对齐）
	const fitAndPlace = useCallback(() => {
		const app = appRef.current;
		const container = containerRef.current;
		const model = modelRef.current;
		if (!app || !container || !model || !app.renderer) return;
		const viewW = (app.renderer.screen && app.renderer.screen.width) || container.clientWidth || 300;
		const viewH = (app.renderer.screen && app.renderer.screen.height) || container.clientHeight || 400;
		const margin = 0.99; // 预留边距
		// 重置比例以获取原始大小
		model.scale.set(1, 1);
		const rawW = Math.max(1, model.width);
		const rawH = Math.max(1, model.height);
		const scaleByW = (viewW * margin) / rawW;
		const scaleByH = (viewH * margin) / rawH;
		const baseScale = Math.min(scaleByW, scaleByH);
		const desired = baseScale * (Number(userScale) || 1);
		const finalScale = Math.max(0.05, Math.min(baseScale, desired));
		model.scale.set(finalScale, finalScale);
		if (model.anchor && typeof model.anchor.set === 'function') {
			model.anchor.set(0, 0);
			model.x = 4; // 左侧留 4px 边距
			model.y = 0; // 顶部贴齐
		} else {
			model.x = 4;
			model.y = 0;
		}
	}, [userScale]);

	// 初始化 Pixi（仅运行一次）
	useEffect(() => {
		// 运行时保障：确保 Cubism4 Core 已加载
		if (typeof window !== 'undefined' && !window.Live2DCubismCore) {
			setError('缺少 Cubism4 Core：请将 live2dcubismcore.min.js 放到 public/live2dsrc/ 并在 index.html 中通过 <script src="/live2dsrc/live2dcubismcore.min.js"></script> 引入');
			setLoading(false);
			return;
		}

		const container = containerRef.current;
		if (!container) return;

		const app = new Application({
			resizeTo: container,
			backgroundAlpha: 0,
			antialias: true,
			// 让画布以高分屏分辨率渲染，显著提高清晰度
			autoDensity: true,
			resolution: dpi,
			// 避免亚像素渲染导致的轻微发糊
			roundPixels: true,
			powerPreference: 'high-performance',
		});

		appRef.current = app;
		container.querySelector('.maid-canvas-wrap').appendChild(app.view);


		const onResize = () => fitAndPlace();
		window.addEventListener('resize', onResize);

		// 在清理函数中使用当下捕获的缓存引用
		const cachedAtMount = preloadedRef.current;
		return () => {
			window.removeEventListener('resize', onResize);
			try {
				// 仅从舞台移除当前模型
				if (modelRef.current) {
					try { app.stage.removeChild(modelRef.current); } catch (err) { void err; }
				}
			} catch (err) {
				console.warn('卸载时销毁模型失败', err);
			}
			try {
				// 销毁所有缓存模型
				cachedAtMount.forEach((m) => {
					try {
						if (m && m.parent) m.parent.removeChild(m);
						m && m.destroy && m.destroy(true);
					} catch (err) { void err; }
				});
				app.destroy(true, { children: true, texture: true, baseTexture: true });
			} catch (err) {
				console.warn('卸载时销毁应用失败', err);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// 加载并显示指定索引的模型（依赖当前的 app 与路径）
	const loadAndShowModel = async (indexToLoad) => {
		const app = appRef.current;
		if (!app) return;
		const paths = modelPaths.length ? modelPaths : [];
		if (!paths.length) return;
		const idx = ((indexToLoad ?? 0) % paths.length + paths.length) % paths.length;
		const path = paths[idx];
		setLoading(true);
		setError('');
		try {
			let model = preloadedRef.current.get(path);
			if (!model) {
				model = await Live2DModel.from(path, { autoInteract: false });
				model.interactive = true;
				if (model.anchor && typeof model.anchor.set === 'function') model.anchor.set(0, 0);
				try { model.autoUpdate = true; } catch (err) { void err; }
				preloadedRef.current.set(path, model);
			}
			// 从舞台移除旧模型
			if (modelRef.current) {
				try { app.stage.removeChild(modelRef.current); } catch (err) { void err; }
			}
			modelRef.current = model;
			app.stage.addChild(model);
			fitAndPlace();
			startIdle(model);
			// 初始化表情选择为第一项，并重置动作分组
			try {
					const settings = model?.internalModel?.settings || model?.internalModel?._settings;
					const expressions = settings?.expressions || settings?.Expressions || settings?._expressions || [];
					if (expressions.length) {
						// 跳过可能的“水印/sy”类表情
						const pick = expressions.find((x) => {
							const nm = (x?.Name || x?.name || '').toLowerCase();
							const fp = (x?.File || x?.file || '').toLowerCase();
							return !(/水印/.test(nm) || nm === 'sy' || fp.includes('sy') || /shuiyin/.test(fp));
						}) || expressions[0];
						const firstName = pick?.Name || pick?.name || '';
						setSelectedExpression(firstName || '');
					} else {
						setSelectedExpression('');
					}
				const motions = settings?.motions || settings?.Motions || {};
				const groups = motions ? Object.keys(motions) : [];
				setActiveMotionGroup(groups[0] || '');
			} catch (err) { void err; }
		} catch (e) {
			console.error(e);
			setError('模型加载失败');
		} finally {
			setLoading(false);
		}
	};

	// 当模型列表或索引变化时，加载对应模型
	useEffect(() => {
		if (!modelPaths.length) return;
		loadAndShowModel(modelIndex);
		// 关闭面板，避免切换时遮挡
		setEmotionOpen(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [modelPaths, modelIndex]);

	// 加载模型清单（将 public/live2dmodels 下的所有 *.model3.json 导入）
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch('/live2dmodels/manifest.json', { cache: 'no-cache' });
				if (!res.ok) throw new Error('manifest 加载失败');
				const data = await res.json();
				if (cancelled) return;
				const list = Array.isArray(data?.models) ? data.models : [];
				if (list.length) {
					setModelPaths(list);
					setModelIndex(0);
					return;
				}
				throw new Error('manifest 无模型');
			} catch {
				// 回退到内置的少量路径（兼容旧行为）
				const fallback = [
					'/live2dmodels/樱花狐/Bhuxian/Bhuxian.model3.json',
					'/live2dmodels/applefox/A苹果小狐狸/A苹果小狐狸.model3.json',
					'/live2dmodels/粉鼠团子/团子模型文件/团子出击/团子出击.model3.json',
				];
				if (!cancelled) setModelPaths(fallback);
			}
		})();
		return () => { cancelled = true; };
	}, []);

	// 清晰度（渲染分辨率）动态调整
	useEffect(() => {
		const app = appRef.current;
		const container = containerRef.current;
		if (!app || !container || !app.renderer) return;
		const r = Math.max(1, Math.min(3, Number(dpi) || 1));
		try {
			if (app.renderer.resolution !== r) {
				app.renderer.resolution = r;
				// 触发内部缓冲区重建，保持 CSS 尺寸不变
				app.renderer.resize(container.clientWidth, container.clientHeight);
			}
		} catch (e) {
			console.warn('调整清晰度失败', e);
		}
	}, [dpi]);

	// 大小倍率调整时，按当前容器尺寸重新适配
	useEffect(() => {
		try { fitAndPlace(); } catch (e) { console.warn('根据大小倍率适配失败', e); }
	}, [fitAndPlace]);

	// 切换模型：按需加载并缓存
	const handleSwitch = async () => {
		if (!modelPaths.length) return;
		if (loading) return; // 加载中暂不切换，避免拥塞
		const next = (modelIndex + 1) % modelPaths.length;
		setModelIndex(next);
		// 加载与显示由上面 useEffect 处理
	};

	// 表情选择改为“选择即应用”，无需单独的应用函数

	// 展开/收起：收起时自动关闭设置面板
	const toggleCollapsed = () => {
		setCollapsed((prev) => {
			const next = !prev;
			if (next) setSettingsOpen(false);
			return next;
		});
	};

	// 打开/关闭设置面板：若处于收起状态则先展开
	const toggleSettings = () => {
		setCollapsed(false);
		setSettingsOpen((v) => !v);
	};

	return (
	  <div
	    ref={containerRef}
	    className={`maid-widget maid-float${collapsed ? ' maid-collapsed' : ''}`}
	    style={{ right: 20, bottom: 20 }}
	  >
	    <div className="maid-canvas-wrap" />

			{/* 设置面板：点击设置图标后出现，承载清晰度与大小控件 */}
			{settingsOpen && !collapsed && (
				<div id="maid-settings-panel" className="maid-settings-panel" role="dialog" aria-label="看板娘设置">
					<div className="maid-field">
						<label className="maid-controls-label" htmlFor="maidDpi">清晰度</label>
						<select
							id="maidDpi"
							className="maid-select"
							value={String(dpi)}
							onChange={(e) => setDpi(parseFloat(e.target.value))}
							title="调整渲染分辨率，数值越大越清晰但越耗性能"
						>
							<option value="1">1x</option>
							<option value="2">2x</option>
							<option value="3">3x</option>
						</select>
					</div>
					<div className="maid-field">
						<label className="maid-controls-label" htmlFor="maidScale">大小</label>
						<input
							id="maidScale"
							className="maid-range"
							type="range"
							min="0.5"
							max="1"
							step="0.01"
							value={userScale}
							onChange={(e) => setUserScale(parseFloat(e.target.value))}
							title="按最大适配大小(1x)的比例进行缩放，最小为1/2"
						/>
					</div>
				</div>
			)}

			{/* 底部控制条：将“表情”按钮放到最左侧；仅点击显示列表 */}
			<div className="maid-controlbar">
				{(() => {
					const disabled = getExpressions().length === 0;
					return (
						<button
							className={`maid-iconbtn${emotionOpen ? ' maid-iconbtn-active' : ''}`}
							title={disabled ? '当前模型未提供表情' : '表情列表'}
							aria-label="表情列表"
							aria-expanded={emotionOpen}
							disabled={disabled}
							onClick={() => setEmotionOpen((v) => !v)}
						>
							<img src="/icons/maid/emotion.svg" alt="表情" />
						</button>
					);
				})()}
				{/* 已移除独立“动作”控件，动作列表合并在表情面板中 */}
				<button
					className="maid-toggle"
					aria-pressed={collapsed}
					onClick={toggleCollapsed}
					title={collapsed ? '展开' : '收起'}
				>
					{collapsed ? '展开' : '收起'}
				</button>
				<button
					className="maid-iconbtn"
					onClick={handleSwitch}
					title="切换模型"
					aria-label="切换模型"
					disabled={loading || !modelPaths.length}
				>
					<img src="/icons/maid/clothes.svg" alt="切换模型" />
				</button>
				<button
					className={`maid-iconbtn${settingsOpen ? ' maid-iconbtn-active' : ''}`}
					onClick={toggleSettings}
					title="设置"
					aria-label="设置"
					aria-expanded={settingsOpen}
					aria-controls="maid-settings-panel"
				>
					<img src="/icons/maid/config.svg" alt="设置" />
				</button>

				{/* 当前模型序号指示 */}
				<span className="maid-counter" aria-live="polite" title="当前模型序号">
					{modelPaths.length ? `${modelIndex + 1}/${modelPaths.length}` : '0/0'}
				</span>
			</div>

			{(() => {
				// 表情面板（已合并动作）：显示在画布左侧，包含“表情”和“动作”两部分
				const exprs = getExpressions();
				const motions = getMotions();
				const exprDisabled = exprs.length === 0;
				const motionDisabled = motions.length === 0;
				if (collapsed || !emotionOpen || (exprDisabled && motionDisabled)) return null;
				const groups = motions.map((g) => g.groupName);
				const currentGroup = activeMotionGroup && groups.includes(activeMotionGroup) ? activeMotionGroup : (groups[0] || '');
				const currentItems = motions.find((g) => g.groupName === currentGroup)?.items || [];
				return (
					<div className="maid-emotion-panel maid-emotion-panel-left" role="menu" aria-label="选择表情与动作">
						{/* 表情区 */}
						{!exprDisabled && (
							<>
								<div className="maid-section-title">表情</div>
								<ul className="maid-emotion-list" role="listbox" aria-activedescendant={selectedExpression || undefined}>
									{exprs.map((e) => (
										<li key={e.name} role="option" aria-selected={selectedExpression === e.name}>
											<button
												type="button"
												className={`maid-emotion-item${selectedExpression === e.name ? ' active' : ''}`}
												onClick={async () => {
													setSelectedExpression(e.name);
													try {
														const model = modelRef.current;
														if (model) await model.expression(e.name);
													} catch (err) {
														console.warn('应用表情失败', err);
													}
													// 选择即应用并关闭面板
													setEmotionOpen(false);
												}}
												title={`应用表情：${e.displayName || e.name}`}
											>
												{e.displayName || e.name}
											</button>
										</li>
									))}
								</ul>
							</>
						)}
						{/* 动作区（合并） */}
						{!motionDisabled && (
							<>
								<div className="maid-section-title">动作</div>
								{groups.length > 1 && (
									<div className="maid-motion-groups" role="tablist" aria-label="动作分组">
										{groups.map((g) => (
											<button
												key={g}
												className={`maid-tab${g === currentGroup ? ' active' : ''}`}
												role="tab"
												aria-selected={g === currentGroup}
												onClick={() => setActiveMotionGroup(g)}
												title={`分组：${g}`}
											>
												{g}
											</button>
										))}
									</div>
								)}
								<ul className="maid-motion-list" role="listbox">
									{currentItems.map((m, i) => (
										<li key={`${currentGroup}-${i}`} role="option">
											<button
												className="maid-motion-item"
												onClick={async () => {
													try {
														const model = modelRef.current;
														if (model) await model.motion(currentGroup, i);
													} catch (err) {
														console.warn('播放动作失败', err);
													}
													// 选择后关闭面板
													setEmotionOpen(false);
											}}
											title={`播放：${m.name || currentGroup + '-' + i}`}
											>
												{m.name || `${currentGroup}-${i}`}
											</button>
										</li>
									))}
								</ul>
							</>
						)}
					</div>
				);
			})()}

	    {loading && (
	    	<div className="maid-loading-overlay" aria-busy="true">
	    		<div className="maid-spinner" />
	    		<div className="maid-loading-text">模型加载中…</div>
	    	</div>
	    )}
	    {error && <div className="maid-error">{error}</div>}
	  </div>
	);
}
