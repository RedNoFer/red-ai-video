# 《Mahadel：四界之心》完整制作包

> 制作包格式：`vozeb-drama-production-package-v1`
> 规范数据源：JSON；本文件由同一对象确定性导出。
> 目标平台：Seedance 2.5｜语言：中文｜画幅：9:16｜成片：约 180 秒

## 规范对象（导入权威数据）

```drama-production-package
{
  "schemaVersion": 1,
  "project": {
    "title": "Mahadel：四界之心",
    "summary": "两个几乎没有灵压的 Mahadel 新生进入受皇家法师严密监视的阿佐雷斯，他们隐藏的力量与 Karin 的断剑同时引起了某个古老存在的注意。",
    "style": "VS14 中世纪史诗的学院奇幻变体；宏大空间与克制人物近景并重，不使用现代元素或科幻 UI。",
    "ratio": "9:16",
    "productionBible": {
      "targetPlatform": "Seedance 2.5",
      "language": "中文",
      "ratio": "9:16",
      "targetDuration": 180,
      "visualStyle": "VS14 中世纪史诗的学院奇幻变体；宏大空间与克制人物近景并重，不使用现代元素或科幻 UI。",
      "colorScript": "CN3 悬疑逼近，雾蓝灰 → 暗紫红 → 短暂银白爆发 → 炉火琥珀 → 冷紫黑",
      "soundBible": "按镜头声音设计表执行，保留对白空间与静默段落",
      "globalNegativePrompt": "无字幕、无水印、无logo、无现代元素、无角色身份漂移",
      "subtitleSafeArea": "角色头顶与画面底部保留安全区",
      "continuityMode": "strict",
      "productionPlan": {
        "version": "drama-production-plan-v1",
        "skills": [],
        "video": {
          "model": "seedance-2-5",
          "mode": "reference",
          "ratio": "9:16",
          "resolution": "720p",
          "durationPolicy": "shot",
          "count": 1,
          "audioMode": "native",
          "allowExplicitFallback": false
        },
        "references": {
          "strategy": "adaptive",
          "minImages": 3,
          "maxImages": 5,
          "roles": [
            "previous_actual_tail",
            "character_anchor",
            "scene_anchor",
            "prop_anchor",
            "action_keyframe",
            "composition_keyframe"
          ]
        },
        "continuity": {
          "mode": "strict",
          "requireAcceptedActualTail": true
        },
        "source": "package"
      }
    }
  },
  "assets": {
    "characters": [
      {
        "code": "C01",
        "name": "Karin",
        "description": "角色：18岁男性，来自安静边境村镇Eda，身高约178厘米，清瘦但有长期训练形成的肩背力量。窄鹅蛋脸，下颌线清晰但不锋利，灰绿色杏眼，眼下轻微疲惫阴影，平直深棕眉，高直鼻梁，薄唇，右眉尾有一道极淡旧疤。深栗棕短发，额前自然碎发，后颈略长。肤色偏冷的浅小麦色，可见毛孔、鼻梁雀斑、下颌轻微绒毛与训练留下的手部剑茧。",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "灰绿色眼睛、右眉尾淡疤、深栗棕碎发、Mahadel银黑徽记、断剑不对称双翼护手",
          "styling": "底层灰白亚麻衬衣，外层深墨绿短斗篷，旧黑蓝皮革护肩，窄版深棕腰带，深灰长裤，磨损皮靴；胸前佩戴Mahadel一年级小型银黑徽记",
          "colorPalette": "",
          "consistencyRules": "固定：灰绿色眼睛、右眉尾淡疤、深栗棕碎发、Mahadel银黑徽记、断剑不对称双翼护手",
          "designPrompt": "电影级全量角色设定卡，主题《Mahadel：四界之心》，主角Karin。9:16竖版，六模块纵向全量版，中性浅灰背景，用于AI视频角色一致性。\n\n角色：18岁男性，来自安静边境村镇Eda，身高约178厘米，清瘦但有长期训练形成的肩背力量。窄鹅蛋脸，下颌线清晰但不锋利，灰绿色杏眼，眼下轻微疲惫阴影，平直深棕眉，高直鼻梁，薄唇，右眉尾有一道极淡旧疤。深栗棕短发，额前自然碎发，后颈略长。肤色偏冷的浅小麦色，可见毛孔、鼻梁雀斑、下颌轻微绒毛与训练留下的手部剑茧。\n\n服装：底层灰白亚麻衬衣，外层深墨绿短斗篷，旧黑蓝皮革护肩，窄版深棕腰带，深灰长裤，磨损皮靴；胸前佩戴Mahadel一年级小型银黑徽记。腰后是一把断剑：暗银剑身在护手上方一掌处折断，旧皮剑鞘，护手为不对称双翼形，剑柄缠深蓝旧布。随身护符是暗黄铜圆片，边缘有失灵后的焦黑痕。\n\n六模块必须完整并自上而下排列：顶部主立绘；中上正面、侧面、背面三视图并严格同基线；中部面部五角度；中下五种表情：好奇、克制恼火、被Rifa逗笑、力量释放时冷静、记忆侵入时惊惧；下部手部特写，展示剑茧、握断剑和触碰护符；底部断剑、护符、发型与斗篷动态参考。\n\n不可变特征红框标注：灰绿色眼睛、右眉尾淡疤、深栗棕碎发、Mahadel银黑徽记、断剑不对称双翼护手。所有模块同一张脸、同一身高、同一肩宽、同一服装层次。自然皮肤纹理，visible skin pores, subtle freckles, natural peach fuzz, worn leather grain, woven linen fibers。\n\n风格：VS14中世纪史诗学院奇幻变体，克制写实，深蓝灰、旧银、墨绿、少量暖金；电影定妆质感，85mm人像柔和侧光。负面提示词：no watermark, no logo, no random large text, no garbled Chinese, no broken faces, no duplicated limbs, no extra fingers, no messy panels, no low-quality collage, no modern clothing, no technology, no western cowboy elements, no airbrushed skin, no beauty filter, no plastic doll skin, no smooth featureless face, no over-smoothed skin texture, no perfect porcelain skin, no background scene, no action poster。",
          "identityAnchors": [
            "灰绿色眼睛",
            "右眉尾淡疤",
            "深栗棕碎发",
            "Mahadel银黑徽记",
            "断剑不对称双翼护手"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": [
            "no watermark, no logo, no random large text, no garbled Chinese, no broken faces, no duplicated limbs, no extra fingers, no messy panels, no low-quality collage, no modern clothing, no technology, no western cowboy elements, no airbrushed skin, no beauty filter, no plastic doll skin, no smooth featureless face, no over-smoothed skin texture, no perfect porcelain skin, no background scene, no action poster。"
          ]
        }
      },
      {
        "code": "C02",
        "name": "Rifa",
        "description": "角色：18岁女性，与Karin一同来自Eda，身高约171厘米，身形敏捷结实，站姿稳定，重心略向前。柔和方圆脸，琥珀棕上挑眼，浓密自然眉，鼻梁直而鼻尖微圆，唇形清晰，左颧骨有一颗小痣。暖棕肤色，真实毛孔与日晒形成的轻微色差。浓黑微卷长发编成一条偏低侧辫，额前有两缕短发，辫尾用暗红线固定。",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "琥珀棕上挑眼、左颧骨小痣、低侧辫与暗红辫绳、左肩Mahadel徽记、短刃黑木握柄红线",
          "styling": "灰蓝立领亚麻内衫，炭灰长斗篷，暗红窄围巾，深棕轻皮护腕，黑灰长裤与软底长靴；Mahadel一年级银黑徽记固定在左肩",
          "colorPalette": "",
          "consistencyRules": "固定：琥珀棕上挑眼、左颧骨小痣、低侧辫与暗红辫绳、左肩Mahadel徽记、短刃黑木握柄红线",
          "designPrompt": "电影级全量角色设定卡，主题《Mahadel：四界之心》，主角Rifa。9:16竖版，六模块纵向全量版，中性浅灰背景，用于AI视频角色一致性。\n\n角色：18岁女性，与Karin一同来自Eda，身高约171厘米，身形敏捷结实，站姿稳定，重心略向前。柔和方圆脸，琥珀棕上挑眼，浓密自然眉，鼻梁直而鼻尖微圆，唇形清晰，左颧骨有一颗小痣。暖棕肤色，真实毛孔与日晒形成的轻微色差。浓黑微卷长发编成一条偏低侧辫，额前有两缕短发，辫尾用暗红线固定。\n\n服装：灰蓝立领亚麻内衫，炭灰长斗篷，暗红窄围巾，深棕轻皮护腕，黑灰长裤与软底长靴；Mahadel一年级银黑徽记固定在左肩。武器为一柄短刃，哑光钢刃，黑木握柄缠暗红细线，窄鞘贴右腰。无多余珠宝。\n\n六模块必须完整并自上而下排列：顶部主立绘；中上正面、侧面、背面三视图；中部面部五角度；中下五种表情：警觉、带刺调侃、压低担忧、面对检查官的冷静、抓住Karin时的恐惧；下部手部特写，展示护腕、握短刃和抓住Karin手腕；底部短刃、徽记、红围巾、辫尾与斗篷动态参考。\n\n不可变特征红框标注：琥珀棕上挑眼、左颧骨小痣、低侧辫与暗红辫绳、左肩Mahadel徽记、短刃黑木握柄红线。所有模块保持同一面孔、头身比和服装层次。自然皮肤纹理，visible skin pores, subtle sun variation, natural peach fuzz, realistic woven cloth, worn leather edges。\n\n风格：VS14中世纪史诗学院奇幻变体，克制写实，炭灰、灰蓝、暗红、旧银；85mm人像侧光。负面提示词：no watermark, no logo, no random large text, no garbled Chinese, no broken faces, no duplicated limbs, no extra fingers, no messy panels, no low-quality collage, no modern clothing, no technology, no airbrushed skin, no beauty filter, no plastic doll skin, no smooth featureless face, no over-smoothed skin texture, no perfect porcelain skin, no background scene, no action poster。",
          "identityAnchors": [
            "琥珀棕上挑眼",
            "左颧骨小痣",
            "低侧辫与暗红辫绳",
            "左肩Mahadel徽记",
            "短刃黑木握柄红线"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": [
            "no watermark, no logo, no random large text, no garbled Chinese, no broken faces, no duplicated limbs, no extra fingers, no messy panels, no low-quality collage, no modern clothing, no technology, no airbrushed skin, no beauty filter, no plastic doll skin, no smooth featureless face, no over-smoothed skin texture, no perfect porcelain skin, no background scene, no action poster。"
          ]
        }
      },
      {
        "code": "C03",
        "name": "Ras",
        "description": "角色：19岁男性，身高185厘米，宽肩但动作安静，深褐肤色，长方脸，眉骨清晰，深蓝黑眼睛，鼻梁略宽，唇角常保持克制。黑色短卷发，左侧太阳穴有一道细小竖疤。服装为Mahadel深海军蓝长外套、灰白内衫、银线窄领、旧棕皮手套与黑靴，腰侧携带折叠式星盘，不携带主武器。",
        "activeEpisodeCodes": [],
        "profile": {
          "visualIdentity": "左太阳穴竖疤、蓝黑眼睛、黑短卷发、海军蓝长外套、银色折叠星盘",
          "styling": "",
          "colorPalette": "",
          "consistencyRules": "固定：左太阳穴竖疤、蓝黑眼睛、黑短卷发、海军蓝长外套、银色折叠星盘",
          "designPrompt": "电影级全量角色设定卡，主题《Mahadel：四界之心》，核心角色Ras。9:16竖版，六模块纵向全量版，中性浅灰背景。暂定视觉设定，未在第一集出镜，不得加入第一集视频参考。\n\n角色：19岁男性，身高185厘米，宽肩但动作安静，深褐肤色，长方脸，眉骨清晰，深蓝黑眼睛，鼻梁略宽，唇角常保持克制。黑色短卷发，左侧太阳穴有一道细小竖疤。服装为Mahadel深海军蓝长外套、灰白内衫、银线窄领、旧棕皮手套与黑靴，腰侧携带折叠式星盘，不携带主武器。\n\n六模块：严格三视图、面部五角度、平静/审视/保护欲/愤怒/疲惫五表情、戴手套与操作星盘的手部、星盘结构细节、外套动态。不可变特征：左太阳穴竖疤、蓝黑眼睛、黑短卷发、海军蓝长外套、银色折叠星盘。真实皮肤和织物材质。\n\n风格：VS14中世纪史诗学院奇幻变体。负面提示词：no watermark, no logo, no garbled text, no broken anatomy, no extra limbs, no modern technology, no sci-fi HUD, no airbrushed skin, no beauty filter, no plastic doll skin, no background scene。",
          "identityAnchors": [
            "左太阳穴竖疤",
            "蓝黑眼睛",
            "黑短卷发",
            "海军蓝长外套",
            "银色折叠星盘"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": [
            "no watermark, no logo, no garbled text, no broken anatomy, no extra limbs, no modern technology, no sci-fi HUD, no airbrushed skin, no beauty filter, no plastic doll skin, no background scene。"
          ]
        }
      },
      {
        "code": "C04",
        "name": "Ref",
        "description": "角色：18岁非二元气质青年，身高168厘米，骨架轻、动作迅速。苍白偏暖肤色，心形脸，浅灰蓝圆眼，细直眉，小而挺的鼻，嘴角有习惯性半笑。亚麻金短发，耳侧略长，后颈束一小撮。服装为Mahadel烟紫短外套、米白高领内衫、墨黑窄裤、浅棕软靴，胸口挂一枚四页形旧钥匙，指尖常有墨迹。",
        "activeEpisodeCodes": [],
        "profile": {
          "visualIdentity": "浅灰蓝圆眼、亚麻金耳侧长短发、指尖墨迹、烟紫短外套、四页旧钥匙",
          "styling": "",
          "colorPalette": "",
          "consistencyRules": "固定：浅灰蓝圆眼、亚麻金耳侧长短发、指尖墨迹、烟紫短外套、四页旧钥匙",
          "designPrompt": "电影级全量角色设定卡，主题《Mahadel：四界之心》，核心角色Ref。9:16竖版，六模块纵向全量版，中性浅灰背景。暂定视觉设定，未在第一集出镜，不得加入第一集视频参考。\n\n角色：18岁非二元气质青年，身高168厘米，骨架轻、动作迅速。苍白偏暖肤色，心形脸，浅灰蓝圆眼，细直眉，小而挺的鼻，嘴角有习惯性半笑。亚麻金短发，耳侧略长，后颈束一小撮。服装为Mahadel烟紫短外套、米白高领内衫、墨黑窄裤、浅棕软靴，胸口挂一枚四页形旧钥匙，指尖常有墨迹。\n\n六模块：严格三视图、面部五角度、好奇/狡黠/专注/受伤掩饰/真正恐惧五表情、沾墨手指与转动钥匙的手部、四页旧钥匙细节、短外套与发尾动态。不可变特征：浅灰蓝圆眼、亚麻金耳侧长短发、指尖墨迹、烟紫短外套、四页旧钥匙。真实皮肤纹理和旧金属磨损。\n\n风格：VS14中世纪史诗学院奇幻变体。负面提示词：no watermark, no logo, no garbled text, no broken anatomy, no extra limbs, no modern clothing, no technology, no airbrushed skin, no beauty filter, no plastic doll skin, no background scene。",
          "identityAnchors": [
            "浅灰蓝圆眼",
            "亚麻金耳侧长短发",
            "指尖墨迹",
            "烟紫短外套",
            "四页旧钥匙"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": [
            "no watermark, no logo, no garbled text, no broken anatomy, no extra limbs, no modern clothing, no technology, no airbrushed skin, no beauty filter, no plastic doll skin, no background scene。"
          ]
        }
      },
      {
        "code": "C05",
        "name": "城门检查官",
        "description": "45-55岁男性，铁灰短发，方脸，冷褐眼，皇家深蓝制服与银色肩扣，左手持黄铜灵压探测器；不可变为右眼下方旧伤、银肩扣、黄铜探测器。",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "不可变为右眼下方旧伤、银肩扣、黄铜探测器。",
          "styling": "",
          "colorPalette": "",
          "consistencyRules": "固定：不可变为右眼下方旧伤、银肩扣、黄铜探测器。",
          "designPrompt": "45-55岁男性，铁灰短发，方脸，冷褐眼，皇家深蓝制服与银色肩扣，左手持黄铜灵压探测器；不可变为右眼下方旧伤、银肩扣、黄铜探测器。",
          "identityAnchors": [
            "不可变为右眼下方旧伤、银肩扣、黄铜探测器。"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": []
        }
      },
      {
        "code": "C06",
        "name": "奥伦·奈特",
        "description": "55-65岁男性，灰白后梳长发，短灰胡须，左眼旧皮革眼罩，右眼清亮，左臂厚重黑皮铸造护具，深棕工作围裙；不可变为左眼罩、无头锤柄、烧伤左手、右眼淡金虹膜。",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "不可变为左眼罩、无头锤柄、烧伤左手、右眼淡金虹膜。",
          "styling": "",
          "colorPalette": "",
          "consistencyRules": "固定：不可变为左眼罩、无头锤柄、烧伤左手、右眼淡金虹膜。",
          "designPrompt": "55-65岁男性，灰白后梳长发，短灰胡须，左眼旧皮革眼罩，右眼清亮，左臂厚重黑皮铸造护具，深棕工作围裙；不可变为左眼罩、无头锤柄、烧伤左手、右眼淡金虹膜。",
          "identityAnchors": [
            "不可变为左眼罩、无头锤柄、烧伤左手、右眼淡金虹膜。"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": []
        }
      },
      {
        "code": "C07",
        "name": "神秘观察者",
        "description": "高瘦身形，深紫黑连帽斗篷，脸始终处于阴影，右手戴四点银戒；第一集禁止露脸，身份不锁定。",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "身份不锁定。",
          "styling": "",
          "colorPalette": "",
          "consistencyRules": "固定：身份不锁定。",
          "designPrompt": "高瘦身形，深紫黑连帽斗篷，脸始终处于阴影，右手戴四点银戒；第一集禁止露脸，身份不锁定。",
          "identityAnchors": [
            "身份不锁定。"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": []
        }
      }
    ],
    "locations": [
      {
        "code": "S01",
        "name": "Mahadel 与四界中心",
        "description": "场景九宫格空间锁定参考板，主题《Mahadel：四界之心》，场景：位于四界交汇中心的古老学院。9:16竖版，3列×3行纵向九宫格，所有九格保持同一时刻、同一阴云天光、同一冷暖色温。",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "场景九宫格空间锁定参考板，主题《Mahadel：四界之心》，场景：位于四界交汇中心的古老学院。9:16竖版，3列×3行纵向九宫格，所有九格保持同一时刻、同一阴云天光、同一冷暖色温。",
          "styling": "",
          "colorPalette": "深蓝灰、玄武岩黑、旧银、极少暖金",
          "consistencyRules": "固定学院位于四界交汇高原中央；四条石桥汇入中央记忆塔；无门拱廊为主入口，入口上方悬浮记忆灯；风暴云海、发光森林、赤红山脉与永夜冰原的边界位置不变；冷白主光始终自左上，镜头保持同一空间轴线。",
          "designPrompt": "场景九宫格空间锁定参考板，主题《Mahadel：四界之心》，场景：位于四界交汇中心的古老学院。9:16竖版，3列×3行纵向九宫格，所有九格保持同一时刻、同一阴云天光、同一冷暖色温。\n\n格1正面全景：黑色古石学院坐落在四种地貌交汇的高原中心，远方分别可见风暴云海、发光森林、赤红山脉与永夜冰原；格2左侧全景：拱桥、塔群与风暴界边；格3右侧全景：阶梯式图书塔与发光森林界边；格4入口：高耸无门拱廊与悬浮记忆灯；格5核心地标：四条石桥汇入中央记忆塔；格6关键结构：封存记忆的玻璃灯与黑石基座；格7地面材质：被岁月磨亮的黑色玄武岩、银色细纹；格8天空与主光：四界天空在学院上方形成静止旋涡，冷白天光自左上；格9角色尺度：两名学生剪影站在巨型回廊下，突出学院尺度。\n\n色彩：深蓝灰、玄武岩黑、旧银、极少暖金。电影级纵深、远古记忆感、克制史诗。clear spatial hierarchy, readable depth, controlled atmosphere, consistent spatial reference across all views, no single-angle only, no random decoration, no background clutter。负面提示词：no watermark, no logo, no random large text, no garbled Chinese, no modern elements, no technology, no western city skyline, no cartoon style, no flat illustration, no marketing poster style。",
          "identityAnchors": [],
          "spatialRules": [
            "学院位于四界交汇高原中央",
            "四条石桥汇入中央记忆塔",
            "无门拱廊为主入口，悬浮记忆灯位于入口上方",
            "四界地貌边界位置固定：风暴云海、发光森林、赤红山脉、永夜冰原",
            "冷白主光自左上，镜头保持同一空间轴线"
          ],
          "stateRules": [],
          "forbiddenChanges": [
            "no watermark, no logo, no random large text, no garbled Chinese, no modern elements, no technology, no western city skyline, no cartoon style, no flat illustration, no marketing poster style。"
          ]
        }
      },
      {
        "code": "S02",
        "name": "阿佐雷斯城门与皇家结界",
        "description": "场景九宫格空间锁定参考板，主题《Mahadel：四界之心》，场景：阿佐雷斯北城门与皇家奥术结界。9:16竖版，3列×3行纵向九宫格，同一午后、同一阴天天光、同一结界状态。",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "场景九宫格空间锁定参考板，主题《Mahadel：四界之心》，场景：阿佐雷斯北城门与皇家奥术结界。9:16竖版，3列×3行纵向九宫格，同一午后、同一阴天天光、同一结界状态。",
          "styling": "双塔位置、检查台在左、法师平台在右、界碑在闸门前、主光左上",
          "colorPalette": "暗蓝灰与少量皇家暗红",
          "consistencyRules": "固定双塔城门与中央拱门的中轴关系；检查台始终在画面左侧，法师平台在右侧，银色界碑位于闸门前；道路由前景通向拱门并穿过结界；结界保持同一透明穹顶状态，主光自左上，镜头不得越过人物与城门的180度轴线。",
          "designPrompt": "场景九宫格空间锁定参考板，主题《Mahadel：四界之心》，场景：阿佐雷斯北城门与皇家奥术结界。9:16竖版，3列×3行纵向九宫格，同一午后、同一阴天天光、同一结界状态。\n\n格1正面全景：双塔石城门、中央拱门、排队马车与高处法师平台；格2左侧全景：检查台、银色界碑、候检人群边界；格3右侧全景：皇家法师旋梯与结界控制石柱；格4入口：道路穿过透明水波状结界的视角；格5核心地标：刻四向纹路的银黑城门拱顶；格6关键道具：黄铜灵压探测器与发出微光的Mahadel徽记比例；格7地面：浅灰石板、车辙、少量湿泥；格8天空与主光：结界像透明穹顶折射冷白天光，主光从正上偏左；格9角色尺度：Karin与Rifa并肩站在检查官面前，塔楼远高于人物。\n\n固定元素：双塔位置、检查台在左、法师平台在右、界碑在闸门前、主光左上。色彩CN3暗蓝灰与少量皇家暗红。负面提示词：no watermark, no logo, no random text, no modern checkpoint, no firearms, no sci-fi scanners, no HUD, no cartoon style, no flat illustration, no marketing poster style。",
          "identityAnchors": [],
          "spatialRules": [
            "双塔与中央拱门保持中轴关系",
            "检查台始终在画面左侧，法师平台在右侧",
            "银色界碑固定在闸门前，道路由前景通向拱门",
            "透明水波状结界保持同一穹顶边界与状态",
            "主光自左上，镜头保持城门盘查的180度轴线"
          ],
          "stateRules": [],
          "forbiddenChanges": [
            "no watermark, no logo, no random text, no modern checkpoint, no firearms, no sci-fi scanners, no HUD, no cartoon style, no flat illustration, no marketing poster style。"
          ]
        }
      },
      {
        "code": "S03",
        "name": "阿佐雷斯层叠城市",
        "description": "场景九宫格空间锁定参考板，主题《Mahadel：四界之心》，场景：阿佐雷斯层叠铸造城市。9:16竖版，3列×3行纵向九宫格，同一下午、同一薄云与炉火反光。",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "场景九宫格空间锁定参考板，主题《Mahadel：四界之心》，场景：阿佐雷斯层叠铸造城市。9:16竖版，3列×3行纵向九宫格，同一下午、同一薄云与炉火反光。",
          "styling": "Edia Knight位于上行坡道尽头，主街左侧进入；色彩石灰白、铜锈绿、皮革棕、炉火琥珀与雾蓝阴影",
          "colorPalette": "石灰白、铜锈绿、皮革棕、炉火琥珀与雾蓝阴影",
          "consistencyRules": "固定城市沿陡坡向上分七层堆叠；主街从画面左侧进入并通向上行坡道，Edia Knight位于坡道尽头；横跨三层街区的石拱桥、下层铸坊与上层法师塔保持相对位置；天空被建筑切割，炉火只作为下层暖色补光，镜头沿主街上行轴线拍摄。",
          "designPrompt": "场景九宫格空间锁定参考板，主题《Mahadel：四界之心》，场景：阿佐雷斯层叠铸造城市。9:16竖版，3列×3行纵向九宫格，同一下午、同一薄云与炉火反光。\n\n格1正面全景：城市沿陡坡分七层向上堆叠，石屋、塔楼、吊桥和高架水渠交错；格2左侧全景：下层铸坊烟囱与铜色屋顶；格3右侧全景：上层法师塔和悬空水渠；格4入口：从城门进入主街的视角；格5核心地标：横跨三层街区的巨大石拱桥；格6关键道具：蓝玻璃瓶手推车与道路指示铜铃；格7地面：潮湿石阶、金属屑、车轮磨痕；格8天空与主光：被建筑切割的狭窄天空，散射光从上方落下，下层有琥珀炉火补光；格9人物尺度：Karin和Rifa位于密集街道中，城市结构压过人物但不遮挡。\n\n固定空间：Edia Knight位于上行坡道尽头，主街左侧进入；色彩石灰白、铜锈绿、皮革棕、炉火琥珀与雾蓝阴影。负面提示词：no watermark, no logo, no random readable signs, no modern traffic, no neon, no technology, no cartoon style, no flat illustration, no marketing poster style。",
          "identityAnchors": [],
          "spatialRules": [
            "城市沿陡坡向上分七层堆叠",
            "主街从画面左侧进入并通向上行坡道",
            "Edia Knight位于上行坡道尽头",
            "巨大石拱桥横跨三层街区，下层铸坊与上层法师塔位置固定",
            "镜头沿主街上行轴线拍摄，炉火仅作下层补光"
          ],
          "stateRules": [],
          "forbiddenChanges": [
            "no watermark, no logo, no random readable signs, no modern traffic, no neon, no technology, no cartoon style, no flat illustration, no marketing poster style。"
          ]
        }
      },
      {
        "code": "S04",
        "name": "Edia Knight 内外部",
        "description": "场景九宫格空间锁定参考板，主题《Mahadel：四界之心》，场景：Edia Knight铸剑铺。9:16竖版，3列×3行纵向九宫格，傍晚，外部冷光与内部低饱和炉火形成对比。",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "场景九宫格空间锁定参考板，主题《Mahadel：四界之心》，场景：Edia Knight铸剑铺。9:16竖版，3列×3行纵向九宫格，傍晚，外部冷光与内部低饱和炉火形成对比。",
          "styling": "铁砧中央、炉膛后左、柜台右侧、烟黑铜镜悬在铁砧上方、木匣从铁砧下取出",
          "colorPalette": "冷银、煤黑、暗琥珀、极少冷紫",
          "consistencyRules": "固定铸剑铺纵深轴线：入口在前景，铁砧居中，炉膛在后左，柜台在右侧；烟黑铜镜悬在铁砧上方，木匣从铁砧下方取出；外部冷蓝光从门口右后进入，炉火琥珀光从左前照向铁砧；镜头保持店内纵深与三角站位，不重排主要陈设。",
          "designPrompt": "场景九宫格空间锁定参考板，主题《Mahadel：四界之心》，场景：Edia Knight铸剑铺。9:16竖版，3列×3行纵向九宫格，傍晚，外部冷光与内部低饱和炉火形成对比。\n\n格1正面外景：狭窄坡道尽头的深色木门，无门把，门上方木牌嵌一条银色裂痕；格2左侧外景：倾斜石屋墙面与通往主街的坡道；格3右侧外景：无窗石墙、细烟囱与雨水槽；格4入口视角：门开启后看见纵深很长的店内、铁砧居中、炉膛在后左；格5核心地标：黑色炉膛与地面多重圆环刻痕；格6关键道具：铁砧、无头锤柄、四点银纹窄木匣；格7地面材质：黑石地面、金属烧痕与银粉嵌线；格8主光源：外部冷蓝天光从门口右后进入，炉火琥珀光自左前照向铁砧；格9人物尺度：奥伦站在铁砧后，Karin与Rifa位于门槛，三人形成三角站位。\n\n固定元素：铁砧中央、炉膛后左、柜台右侧、烟黑铜镜悬在铁砧上方、木匣从铁砧下取出。色彩冷银、煤黑、暗琥珀、极少冷紫。负面提示词：no watermark, no logo, no random readable text, no modern workshop, no electric tools, no excessive sparks, no clutter hiding spatial layout, no cartoon style, no flat illustration, no marketing poster style。",
          "identityAnchors": [],
          "spatialRules": [
            "入口在前景，铁砧固定居中",
            "炉膛固定在后左，柜台固定在右侧",
            "烟黑铜镜悬在铁砧上方，木匣从铁砧下方取出",
            "外部冷蓝光从门口右后进入，炉火琥珀光从左前照向铁砧",
            "店内纵深和人物三角站位保持不变"
          ],
          "stateRules": [],
          "forbiddenChanges": [
            "no watermark, no logo, no random readable text, no modern workshop, no electric tools, no excessive sparks, no clutter hiding spatial layout, no cartoon style, no flat illustration, no marketing poster style。"
          ]
        }
      },
      {
        "code": "S05",
        "name": "黑湖记忆",
        "description": "无风黑湖、倒悬古塔、雪地四手与冷白无源光",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "倒悬塔位置、无波黑湖、雪地边界",
          "styling": "",
          "colorPalette": "",
          "consistencyRules": "固定：倒悬塔位置、无波黑湖、雪地边界",
          "designPrompt": "黑湖贯穿竖幅，倒悬古塔位置固定，雪地位于画面下方，冷白无源光",
          "identityAnchors": [
            "倒悬塔位置",
            "无波黑湖",
            "雪地边界"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": []
        }
      },
      {
        "code": "S06",
        "name": "前往阿佐雷斯的马车",
        "description": "中世纪封闭木马车，左右长凳、右侧竖向车窗、前进方向固定",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "左右长凳、右侧竖窗、前进方向",
          "styling": "",
          "colorPalette": "",
          "consistencyRules": "固定：左右长凳、右侧竖窗、前进方向",
          "designPrompt": "车厢长凳左右相对，Karin位于左侧、Rifa位于右侧，竖向车窗在Rifa身后，阴天柔光从右上进入",
          "identityAnchors": [
            "左右长凳",
            "右侧竖窗",
            "前进方向"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": []
        }
      }
    ],
    "props": [
      {
        "code": "P01",
        "name": "Karin的断剑",
        "description": "暗银断剑、不对称双翼护手、剑柄缠深蓝旧布",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "不对称双翼护手、断口形态固定",
          "styling": "",
          "colorPalette": "",
          "consistencyRules": "固定：不对称双翼护手、断口形态固定",
          "designPrompt": "暗银断剑，不对称双翼护手，剑柄缠深蓝旧布",
          "identityAnchors": [
            "不对称双翼护手",
            "断口形态固定"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": []
        }
      },
      {
        "code": "P02",
        "name": "失灵护符",
        "description": "暗黄铜圆片，边缘有焦黑痕",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "焦黑边缘",
          "styling": "",
          "colorPalette": "",
          "consistencyRules": "固定：焦黑边缘",
          "designPrompt": "暗黄铜圆片护符",
          "identityAnchors": [
            "焦黑边缘"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": []
        }
      },
      {
        "code": "P03",
        "name": "灵压探测器",
        "description": "黄铜探测器，指针可停在零并从内部裂开",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "黄铜材质",
          "styling": "",
          "colorPalette": "",
          "consistencyRules": "固定：黄铜材质",
          "designPrompt": "皇家黄铜灵压探测器",
          "identityAnchors": [
            "黄铜材质"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": []
        }
      },
      {
        "code": "P04",
        "name": "四点木匣",
        "description": "带银裂痕与四点印记的窄木匣",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "四点印记、银色裂痕",
          "styling": "",
          "colorPalette": "",
          "consistencyRules": "固定：四点印记、银色裂痕",
          "designPrompt": "四点印记窄木匣",
          "identityAnchors": [
            "四点印记",
            "银色裂痕"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": []
        }
      },
      {
        "code": "P05",
        "name": "Rifa短刃",
        "description": "哑光钢刃、黑木握柄缠暗红细线、窄鞘固定右腰",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "黑木红线握柄、窄鞘、右腰位置",
          "styling": "",
          "colorPalette": "",
          "consistencyRules": "固定：黑木红线握柄、窄鞘、右腰位置",
          "designPrompt": "Rifa短刃正侧背细节卡",
          "identityAnchors": [
            "黑木红线握柄",
            "窄鞘",
            "右腰位置"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": []
        }
      },
      {
        "code": "P06",
        "name": "四点银戒",
        "description": "观察者右手佩戴的旧银戒，四个圆点等距排列",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "四点等距、旧银材质",
          "styling": "",
          "colorPalette": "",
          "consistencyRules": "固定：四点等距、旧银材质",
          "designPrompt": "四点银戒多角度细节卡",
          "identityAnchors": [
            "四点等距",
            "旧银材质"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": []
        }
      },
      {
        "code": "P07",
        "name": "无头锤柄",
        "description": "奥伦使用的深色旧木锤柄，没有锤头",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "无锤头、旧木磨损",
          "styling": "",
          "colorPalette": "",
          "consistencyRules": "固定：无锤头、旧木磨损",
          "designPrompt": "无头锤柄正侧面细节卡",
          "identityAnchors": [
            "无锤头",
            "旧木磨损"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": []
        }
      },
      {
        "code": "P08",
        "name": "烟黑铜镜",
        "description": "悬挂在铁砧上方、表面烟黑的旧铜镜",
        "activeEpisodeCodes": [
          "E01"
        ],
        "profile": {
          "visualIdentity": "烟黑镜面、铁砧上方位置",
          "styling": "",
          "colorPalette": "",
          "consistencyRules": "固定：烟黑镜面、铁砧上方位置",
          "designPrompt": "烟黑铜镜正侧面细节卡",
          "identityAnchors": [
            "烟黑镜面",
            "铁砧上方位置"
          ],
          "spatialRules": [],
          "stateRules": [],
          "forbiddenChanges": []
        }
      }
    ],
    "clues": []
  },
  "episodes": [
    {
      "code": "E01",
      "title": "无灵压的旅人",
      "script": "### 场1｜黑湖记忆｜时间不明｜0-15秒\n\n黑湖没有波纹。倒悬在水下的高塔占满竖幅，塔尖正对Karin的倒影。雪地里，四只手彼此抓紧。Karin看不清另外三个人的脸，只看见自己掌心握着一截完整剑刃。\n\n剑刃自行裂开。\n\n记忆中的声音（耳语）：“你又来迟了。”\n\nKarin猛然睁眼。\n\n### 场2｜马车｜白日｜15-45秒\n\nKarin的手仍扣在断剑上。Rifa没有追问，先等他的呼吸恢复。\n\nRifa：“又是那个梦？”\n\nKarin：“只是路太颠。”\n\nRifa看一眼平整得过分的皇家道路：“当然。石头还学会道歉了。”\n\n她把水囊推过去。Karin刚接住，腰间护符忽然闪烁后熄灭。\n\nRifa：“第几个？”\n\nKarin：“今天？”\n\nRifa：“十八岁以后。”\n\nKarin没有回答。车窗外，皇家结界已经逼近。\n\n### 场3｜城门盘查｜午后｜45-75秒\n\n马车穿过水波般的结界，高塔法师同时转头。检查官把黄铜探测器依次对准Karin与Rifa，指针死死停在零。\n\n检查官：“没有灵压，却带着Mahadel的徽记。”\n\nRifa：“你可以说我们很有礼貌。”\n\n检查官抬手，闸门锁链落下：“也可以说，你们在隐藏危险。”\n\nKarin向前半步，挡住检查官看向Rifa的视线。\n\nKarin：“我们只是来修一把剑。”\n\n### 场4｜力量解封｜连续｜75-105秒\n\nRifa不看Karin的脸，只看他扣在断剑上的拇指。那是两人早已约定的信号。她走到与他完全并肩的位置。\n\n两人同时松开封印的一线。\n\n没有火焰，没有雷霆。声音先被抽空。旗帜停在风里，尘埃悬浮，结界向二人凹陷，探测器从内部裂开。\n\nKarin先收力。Rifa慢半拍，确认他站稳才收回力量。\n\nKarin（低声）：“这样够明显吗？”\n\n检查官看见一年级徽记，放下手臂。闸门开启。高塔上，观察者转动四点银戒。\n\n观察者（耳语）：“两个异类。可预言里，缺了两个名字。”\n\n### 场5｜阿佐雷斯街巷｜下午｜105-120秒\n\n城市沿竖向陡坡层层升高。Karin仰头看得出神，断剑撞上手推车，他立刻护住剑鞘。\n\nRifa：“还疼？”\n\nKarin：“剑不会疼。”\n\nRifa放慢脚步，与他并肩：“我问的是你。”\n\nKarin不回答，但没有把手从剑上移开。\n\n### 场6｜Edia Knight门前｜傍晚｜120-135秒\n\n坡道尽头，木牌上的银色裂痕与梦中剑刃的裂口完全相同。\n\nRifa：“你见过这个？”\n\nKarin：“没有。”\n\n他说得太快。抬起的手尚未碰门，断剑先在鞘中震动。门内传来三次锤击，木门自行开启。\n\n奥伦在纵深尽头背对二人：“关门。把剑放到铁砧上。”\n\n### 场7｜铸剑师的警告｜连续｜135-180秒\n\nRifa守在门与Karin之间，直到Karin主动走向铁砧才让开半步。\n\n奥伦不看推荐信：“谁告诉你，它是被打断的？”\n\nKarin：“我看着它断的。”\n\n奥伦：“你看见的是结果。”\n\n无头锤柄碰触断口。炉火缩成一线，店内金属全部朝铁砧偏转。\n\n黑湖、倒塔、四只手。这一次，Karin看清其中一只手腕系着暗红细线。他转头看向Rifa的辫绳。Rifa立刻抓住他的手腕，幻象破碎。\n\n奥伦：“别放开。剑正在借她的记忆认你。”\n\nRifa：“你知道它为什么断？”\n\n奥伦取出带四点印记的木匣：“它不是断了。它在拒绝保持完整。”\n\n他把木匣推向Karin：“而你，不是第一个带它来这里的人。”\n\n铜镜中没有店内三人，只有高塔上的斗篷身影。Rifa的短刃滑出半寸。\n\nRifa：“上一个人是谁？”\n\n奥伦熄灭炉火。黑暗中，木匣再次耳语：“你又来迟了。”\n\n切黑。",
      "outline": "两个几乎没有灵压的 Mahadel 新生进入受皇家法师严密监视的阿佐雷斯，他们隐藏的力量与 Karin 的断剑同时引起了某个古老存在的注意。",
      "hook": "谁曾带着同一把剑来过，木匣为什么记得 Karin？",
      "nextPreview": "进入 Edia Knight 后，追查断剑与木匣的共同记忆。",
      "sourceRange": "《阿佐雷斯的铸剑师》",
      "storyScenes": [
        {
          "code": "SC01",
          "order": 1,
          "title": "黑湖记忆",
          "timeOfDay": "时间不明",
          "timeRange": "0-15秒",
          "locationCode": "S05",
          "summary": "黑湖没有波纹。倒悬在水下的高塔占满竖幅，塔尖正对Karin的倒影。雪地里，四只手彼此抓紧。Karin看不清另外三个人的脸，只看见自己掌心握着一截完整剑刃。\n剑刃自行裂开。\n记忆中的声音（耳语）：“你又来迟了。”\nKarin猛然睁眼。",
          "shotCodes": [
            "SH001",
            "SH002"
          ]
        },
        {
          "code": "SC02",
          "order": 2,
          "title": "马车",
          "timeOfDay": "白日",
          "timeRange": "15-45秒",
          "locationCode": "S06",
          "summary": "Karin的手仍扣在断剑上。Rifa没有追问，先等他的呼吸恢复。\nRifa：“又是那个梦？”\nKarin：“只是路太颠。”\nRifa看一眼平整得过分的皇家道路：“当然。石头还学会道歉了。”\n她把水囊推过去。Karin刚接住，腰间护符忽然闪烁后熄灭。\nRifa：“第几个？”\nKarin：“今天？”\nRifa：“十八岁以后。”\nKarin没有回答。车窗外，皇家结界已经逼近。",
          "shotCodes": [
            "SH003",
            "SH004",
            "SH005",
            "SH006",
            "SH007"
          ]
        },
        {
          "code": "SC03",
          "order": 3,
          "title": "城门盘查",
          "timeOfDay": "午后",
          "timeRange": "45-75秒",
          "locationCode": "S02",
          "summary": "马车穿过水波般的结界，高塔法师同时转头。检查官把黄铜探测器依次对准Karin与Rifa，指针死死停在零。\n检查官：“没有灵压，却带着Mahadel的徽记。”\nRifa：“你可以说我们很有礼貌。”\n检查官抬手，闸门锁链落下：“也可以说，你们在隐藏危险。”\nKarin向前半步，挡住检查官看向Rifa的视线。\nKarin：“我们只是来修一把剑。”",
          "shotCodes": [
            "SH008",
            "SH009",
            "SH010",
            "SH011",
            "SH012"
          ]
        },
        {
          "code": "SC04",
          "order": 4,
          "title": "力量解封",
          "timeOfDay": "连续",
          "timeRange": "75-105秒",
          "locationCode": "S02",
          "summary": "Rifa不看Karin的脸，只看他扣在断剑上的拇指。那是两人早已约定的信号。她走到与他完全并肩的位置。\n两人同时松开封印的一线。\n没有火焰，没有雷霆。声音先被抽空。旗帜停在风里，尘埃悬浮，结界向二人凹陷，探测器从内部裂开。\nKarin先收力。Rifa慢半拍，确认他站稳才收回力量。\nKarin（低声）：“这样够明显吗？”\n检查官看见一年级徽记，放下手臂。闸门开启。高塔上，观察者转动四点银戒。\n观察者（耳语）：“两个异类。可预言里，缺了两个名字。”",
          "shotCodes": [
            "SH013",
            "SH014",
            "SH015",
            "SH016",
            "SH017"
          ]
        },
        {
          "code": "SC05",
          "order": 5,
          "title": "阿佐雷斯街巷",
          "timeOfDay": "下午",
          "timeRange": "105-120秒",
          "locationCode": "S03",
          "summary": "城市沿竖向陡坡层层升高。Karin仰头看得出神，断剑撞上手推车，他立刻护住剑鞘。\nRifa：“还疼？”\nKarin：“剑不会疼。”\nRifa放慢脚步，与他并肩：“我问的是你。”\nKarin不回答，但没有把手从剑上移开。",
          "shotCodes": [
            "SH018",
            "SH019",
            "SH020"
          ]
        },
        {
          "code": "SC06",
          "order": 6,
          "title": "Edia Knight门前",
          "timeOfDay": "傍晚",
          "timeRange": "120-135秒",
          "locationCode": "S04",
          "summary": "坡道尽头，木牌上的银色裂痕与梦中剑刃的裂口完全相同。\nRifa：“你见过这个？”\nKarin：“没有。”\n他说得太快。抬起的手尚未碰门，断剑先在鞘中震动。门内传来三次锤击，木门自行开启。\n奥伦在纵深尽头背对二人：“关门。把剑放到铁砧上。”",
          "shotCodes": [
            "SH021",
            "SH022"
          ]
        },
        {
          "code": "SC07",
          "order": 7,
          "title": "铸剑师的警告",
          "timeOfDay": "连续",
          "timeRange": "135-180秒",
          "locationCode": "S04",
          "summary": "Rifa守在门与Karin之间，直到Karin主动走向铁砧才让开半步。\n奥伦不看推荐信：“谁告诉你，它是被打断的？”\nKarin：“我看着它断的。”\n奥伦：“你看见的是结果。”\n无头锤柄碰触断口。炉火缩成一线，店内金属全部朝铁砧偏转。\n黑湖、倒塔、四只手。这一次，Karin看清其中一只手腕系着暗红细线。他转头看向Rifa的辫绳。Rifa立刻抓住他的手腕，幻象破碎。\n奥伦：“别放开。剑正在借她的记忆认你。”\nRifa：“你知道它为什么断？”\n奥伦取出带四点印记的木匣：“它不是断了。它在拒绝保持完整。”\n他把木匣推向Karin：“而你，不是第一个带它来这里的人。”\n铜镜中没有店内三人，只有高塔上的斗篷身影。Rifa的短刃滑出半寸。\nRifa：“上一个人是谁？”\n奥伦熄灭炉火。黑暗中，木匣再次耳语：“你又来迟了。”\n切黑。",
          "shotCodes": [
            "SH023",
            "SH024",
            "SH025",
            "SH026",
            "SH027",
            "SH028",
            "SH029",
            "SH030"
          ]
        }
      ],
      "shots": [
        {
          "code": "SH001",
          "order": 1,
          "title": "黑湖记忆 1/2",
          "description": "黑湖、倒塔、四手与裂剑",
          "sourceText": "黑湖没有波纹。倒悬在水下的高塔占满竖幅，塔尖正对Karin的倒影。雪地里，四只手彼此抓紧。Karin看不清另外三个人的脸，只看见自己掌心握着一截完整剑刃。\n剑刃自行裂开。\n记忆中的声音（耳语）：“你又来迟了。”\nKarin猛然睁眼。",
          "shotBoundary": "睁眼匹配切",
          "dialogue": "",
          "narration": "记忆：你又来迟了。",
          "utterances": [
            {
              "id": "D01",
              "order": 1,
              "type": "voiceover",
              "speaker": "记忆",
              "text": "你又来迟了。"
            }
          ],
          "imagePrompt": "黑湖、倒塔、四手与裂剑，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频《Mahadel：四界之心》。黑色湖面上下贯穿画面，一座高塔倒悬在水下，塔尖指向Karin的模糊倒影。雪地记忆闪现，四只手从竖幅四侧伸向中央彼此抓紧，不展示另外三人的脸；Karin掌心握着完整剑刃，剑刃自行裂开。耳语：“你又来迟了。”镜头沿倒塔垂直慢推至裂口，再匹配切到马车中Karin猛然睁眼、手扣断剑。深蓝黑、雪白、极少冷银。无字幕、无水印、无logo、无可辨识的Ras或Ref、无额外肢体、无断手、无脸部变形、无现代元素、无HUD、无过量粒子。\n本内部镜头只执行：黑湖、倒塔、四手与裂剑。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "垂直慢推",
          "startFramePrompt": "黑湖、倒塔、四手与裂剑，动作起始状态\n连续性硬约束：本镜建立第一处可复用的入口状态。",
          "endFramePrompt": "Karin在马车中惊醒，手扣断剑，呼吸急促\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无水印、无logo、无可辨识的Ras或Ref、无额外肢体、无断手、无脸部变形、无现代元素、无HUD、无过量粒子。",
          "continuity": {
            "shotSize": "ELS→ECU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按黑湖、倒塔、四手与裂剑的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "黑湖、倒塔、四手与裂剑",
            "actionEnd": "Karin在马车中惊醒，手扣断剑，呼吸急促",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "睁眼匹配切"
          },
          "duration": 7.5,
          "characterCodes": [
            "C01"
          ],
          "propCodes": [
            "P01"
          ],
          "clueCodes": [],
          "locationCode": "S05",
          "storySceneCode": "SC01",
          "timecode": "0-7.5s",
          "dramaticFunction": "B线钩子",
          "lens": "35mm",
          "lighting": "无源冷光",
          "colorPalette": "深蓝黑+雪白",
          "transitionOut": "睁眼匹配切",
          "performanceNotes": "你又来迟了。",
          "performancePlan": {
            "emotionalObjective": "围绕黑湖、倒塔、四手与裂剑完成当前镜头的外在行动目标",
            "emotionalArc": "从进入黑湖、倒塔、四手与裂剑的克制状态开始，经由动作反应推进，在Karin在马车中惊醒，手扣断剑，呼吸急促前收束",
            "speechStyle": "无对白，以呼吸、视线和动作反应传递情绪",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入黑湖、倒塔、四手与裂剑"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "Karin在马车中惊醒，手扣断剑，呼吸急促"
              }
            }
          },
          "dialoguePerformance": [],
          "lightingPlan": {
            "palette": "深蓝黑+雪白",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "无源冷光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "近乎无环境声、远处冰风",
            "soundEffects": "剑刃自裂",
            "music": "无呼吸女声与低弦两音母题"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "进入黑湖、倒塔、四手与裂剑"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "进入黑湖、倒塔、四手与裂剑",
                "holderId": "C01"
              }
            ],
            "environment": "黑湖记忆",
            "lighting": "无源冷光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "黑湖、倒塔、四手与裂剑"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "黑湖、倒塔、四手与裂剑",
                "holderId": "C01"
              }
            ],
            "environment": "黑湖记忆",
            "lighting": "无源冷光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "independent"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH001-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.833,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频《Mahadel：四界之心》",
                "imagePrompt": "黑湖、倒塔、四手与裂剑，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频《Mahadel：四界之心》。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH001-F02",
                "sequenceIndex": 2,
                "startSecond": 0.833,
                "endSecond": 1.667,
                "actionPrompt": "黑色湖面上下贯穿画面，一座高塔倒悬在水下，塔尖指向Karin的模糊倒影",
                "imagePrompt": "黑湖、倒塔、四手与裂剑，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：黑色湖面上下贯穿画面，一座高塔倒悬在水下，塔尖指向Karin的模糊倒影。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH001-F03",
                "sequenceIndex": 3,
                "startSecond": 1.667,
                "endSecond": 2.5,
                "actionPrompt": "雪地记忆闪现，四只手从竖幅四侧伸向中央彼此抓紧，不展示另外三人的脸",
                "imagePrompt": "黑湖、倒塔、四手与裂剑，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：雪地记忆闪现，四只手从竖幅四侧伸向中央彼此抓紧，不展示另外三人的脸。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH001-F04",
                "sequenceIndex": 4,
                "startSecond": 2.5,
                "endSecond": 3.333,
                "actionPrompt": "Karin掌心握着完整剑刃，剑刃自行裂开",
                "imagePrompt": "黑湖、倒塔、四手与裂剑，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin掌心握着完整剑刃，剑刃自行裂开。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH001-F05",
                "sequenceIndex": 5,
                "startSecond": 3.333,
                "endSecond": 4.167,
                "actionPrompt": "耳语：“你又来迟了",
                "imagePrompt": "黑湖、倒塔、四手与裂剑，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：耳语：“你又来迟了。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH001-F06",
                "sequenceIndex": 6,
                "startSecond": 4.167,
                "endSecond": 5,
                "actionPrompt": "”镜头沿倒塔垂直慢推至裂口，再匹配切到马车中Karin猛然睁眼、手扣断剑",
                "imagePrompt": "黑湖、倒塔、四手与裂剑，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”镜头沿倒塔垂直慢推至裂口，再匹配切到马车中Karin猛然睁眼、手扣断剑。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH001-F07",
                "sequenceIndex": 7,
                "startSecond": 5,
                "endSecond": 5.833,
                "actionPrompt": "深蓝黑、雪白、极少冷银",
                "imagePrompt": "黑湖、倒塔、四手与裂剑，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：深蓝黑、雪白、极少冷银。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH001-F08",
                "sequenceIndex": 8,
                "startSecond": 5.833,
                "endSecond": 6.667,
                "actionPrompt": "无字幕、无水印、无logo、无可辨识的Ras或Ref、无额外肢体、无断手、无脸部变形、无现代元素、无HUD、无过量粒子",
                "imagePrompt": "黑湖、倒塔、四手与裂剑，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：无字幕、无水印、无logo、无可辨识的Ras或Ref、无额外肢体、无断手、无脸部变形、无现代元素、无HUD、无过量粒子。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH001-F09",
                "sequenceIndex": 9,
                "startSecond": 6.667,
                "endSecond": 7.5,
                "actionPrompt": "本内部镜头只执行：黑湖、倒塔、四手与裂剑",
                "imagePrompt": "黑湖、倒塔、四手与裂剑，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：黑湖、倒塔、四手与裂剑。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片2",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S05"
              },
              {
                "alias": "@图片3",
                "role": "action_keyframe",
                "purpose": "动作关键帧：由本镜入口状态与动作起点派生，生成前需完成关键帧验收",
                "shotId": "SH001"
              }
            ]
          }
        },
        {
          "code": "SH002",
          "order": 2,
          "title": "黑湖记忆 2/2",
          "description": "Karin在马车中惊醒，手扣断剑，呼吸急促",
          "sourceText": "黑湖没有波纹。倒悬在水下的高塔占满竖幅，塔尖正对Karin的倒影。雪地里，四只手彼此抓紧。Karin看不清另外三个人的脸，只看见自己掌心握着一截完整剑刃。\n剑刃自行裂开。\n记忆中的声音（耳语）：“你又来迟了。”\nKarin猛然睁眼。",
          "shotBoundary": "睁眼匹配切",
          "dialogue": "",
          "narration": "",
          "utterances": [],
          "imagePrompt": "Karin在马车中惊醒，手扣断剑，呼吸急促，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频《Mahadel：四界之心》。黑色湖面上下贯穿画面，一座高塔倒悬在水下，塔尖指向Karin的模糊倒影。雪地记忆闪现，四只手从竖幅四侧伸向中央彼此抓紧，不展示另外三人的脸；Karin掌心握着完整剑刃，剑刃自行裂开。耳语：“你又来迟了。”镜头沿倒塔垂直慢推至裂口，再匹配切到马车中Karin猛然睁眼、手扣断剑。深蓝黑、雪白、极少冷银。无字幕、无水印、无logo、无可辨识的Ras或Ref、无额外肢体、无断手、无脸部变形、无现代元素、无HUD、无过量粒子。\n本内部镜头只执行：Karin在马车中惊醒，手扣断剑，呼吸急促。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "垂直慢推",
          "startFramePrompt": "黑湖、倒塔、四手与裂剑，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "Karin在马车中惊醒，手扣断剑，呼吸急促\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无水印、无logo、无可辨识的Ras或Ref、无额外肢体、无断手、无脸部变形、无现代元素、无HUD、无过量粒子。",
          "continuity": {
            "shotSize": "ELS→ECU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按黑湖、倒塔、四手与裂剑的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "黑湖、倒塔、四手与裂剑",
            "actionEnd": "Karin在马车中惊醒，手扣断剑，呼吸急促",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "睁眼匹配切"
          },
          "duration": 7.5,
          "characterCodes": [
            "C01"
          ],
          "propCodes": [
            "P01"
          ],
          "clueCodes": [],
          "locationCode": "S05",
          "storySceneCode": "SC01",
          "timecode": "7.5-15s",
          "dramaticFunction": "B线钩子",
          "lens": "35mm",
          "lighting": "无源冷光",
          "colorPalette": "深蓝黑+雪白",
          "transitionOut": "睁眼匹配切",
          "performanceNotes": "你又来迟了。",
          "performancePlan": {
            "emotionalObjective": "围绕黑湖、倒塔、四手与裂剑完成当前镜头的外在行动目标",
            "emotionalArc": "从进入黑湖、倒塔、四手与裂剑的克制状态开始，经由动作反应推进，在Karin在马车中惊醒，手扣断剑，呼吸急促前收束",
            "speechStyle": "无对白，以呼吸、视线和动作反应传递情绪",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入黑湖、倒塔、四手与裂剑"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "Karin在马车中惊醒，手扣断剑，呼吸急促"
              }
            }
          },
          "dialoguePerformance": [],
          "lightingPlan": {
            "palette": "深蓝黑+雪白",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "无源冷光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "近乎无环境声、远处冰风",
            "soundEffects": "剑刃自裂",
            "music": "无呼吸女声与低弦两音母题"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "黑湖、倒塔、四手与裂剑"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "黑湖、倒塔、四手与裂剑",
                "holderId": "C01"
              }
            ],
            "environment": "黑湖记忆",
            "lighting": "无源冷光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Karin在马车中惊醒，手扣断剑，呼吸急促"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "Karin在马车中惊醒，手扣断剑，呼吸急促",
                "holderId": "C01"
              }
            ],
            "environment": "黑湖记忆",
            "lighting": "无源冷光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH002-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.833,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频《Mahadel：四界之心》",
                "imagePrompt": "Karin在马车中惊醒，手扣断剑，呼吸急促，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频《Mahadel：四界之心》。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH002-F02",
                "sequenceIndex": 2,
                "startSecond": 0.833,
                "endSecond": 1.667,
                "actionPrompt": "黑色湖面上下贯穿画面，一座高塔倒悬在水下，塔尖指向Karin的模糊倒影",
                "imagePrompt": "Karin在马车中惊醒，手扣断剑，呼吸急促，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：黑色湖面上下贯穿画面，一座高塔倒悬在水下，塔尖指向Karin的模糊倒影。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH002-F03",
                "sequenceIndex": 3,
                "startSecond": 1.667,
                "endSecond": 2.5,
                "actionPrompt": "雪地记忆闪现，四只手从竖幅四侧伸向中央彼此抓紧，不展示另外三人的脸",
                "imagePrompt": "Karin在马车中惊醒，手扣断剑，呼吸急促，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：雪地记忆闪现，四只手从竖幅四侧伸向中央彼此抓紧，不展示另外三人的脸。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH002-F04",
                "sequenceIndex": 4,
                "startSecond": 2.5,
                "endSecond": 3.333,
                "actionPrompt": "Karin掌心握着完整剑刃，剑刃自行裂开",
                "imagePrompt": "Karin在马车中惊醒，手扣断剑，呼吸急促，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin掌心握着完整剑刃，剑刃自行裂开。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH002-F05",
                "sequenceIndex": 5,
                "startSecond": 3.333,
                "endSecond": 4.167,
                "actionPrompt": "耳语：“你又来迟了",
                "imagePrompt": "Karin在马车中惊醒，手扣断剑，呼吸急促，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：耳语：“你又来迟了。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH002-F06",
                "sequenceIndex": 6,
                "startSecond": 4.167,
                "endSecond": 5,
                "actionPrompt": "”镜头沿倒塔垂直慢推至裂口，再匹配切到马车中Karin猛然睁眼、手扣断剑",
                "imagePrompt": "Karin在马车中惊醒，手扣断剑，呼吸急促，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”镜头沿倒塔垂直慢推至裂口，再匹配切到马车中Karin猛然睁眼、手扣断剑。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH002-F07",
                "sequenceIndex": 7,
                "startSecond": 5,
                "endSecond": 5.833,
                "actionPrompt": "深蓝黑、雪白、极少冷银",
                "imagePrompt": "Karin在马车中惊醒，手扣断剑，呼吸急促，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：深蓝黑、雪白、极少冷银。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH002-F08",
                "sequenceIndex": 8,
                "startSecond": 5.833,
                "endSecond": 6.667,
                "actionPrompt": "无字幕、无水印、无logo、无可辨识的Ras或Ref、无额外肢体、无断手、无脸部变形、无现代元素、无HUD、无过量粒子",
                "imagePrompt": "Karin在马车中惊醒，手扣断剑，呼吸急促，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：无字幕、无水印、无logo、无可辨识的Ras或Ref、无额外肢体、无断手、无脸部变形、无现代元素、无HUD、无过量粒子。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH002-F09",
                "sequenceIndex": 9,
                "startSecond": 6.667,
                "endSecond": 7.5,
                "actionPrompt": "本内部镜头只执行：Karin在马车中惊醒，手扣断剑，呼吸急促",
                "imagePrompt": "Karin在马车中惊醒，手扣断剑，呼吸急促，ELS→ECU，无源冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：Karin在马车中惊醒，手扣断剑，呼吸急促。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH001"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S05"
              }
            ]
          }
        },
        {
          "code": "SH003",
          "order": 3,
          "title": "梦醒试探 1/3",
          "description": "Rifa识破梦境，Karin否认",
          "sourceText": "Karin的手仍扣在断剑上。Rifa没有追问，先等他的呼吸恢复。\nRifa：“又是那个梦？”\nKarin：“只是路太颠。”\nRifa看一眼平整得过分的皇家道路：“当然。石头还学会道歉了。”\n她把水囊推过去。Karin刚接住，腰间护符忽然闪烁后熄灭。\nRifa：“第几个？”\nKarin：“今天？”\nRifa：“十八岁以后。”\nKarin没有回答。车窗外，皇家结界已经逼近。",
          "shotBoundary": "水囊动作切",
          "dialogue": "Rifa：又是那个梦？",
          "narration": "",
          "utterances": [
            {
              "id": "D02",
              "order": 1,
              "type": "dialogue",
              "speaker": "Rifa",
              "text": "又是那个梦？"
            }
          ],
          "imagePrompt": "Rifa识破梦境，Karin否认，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频。延续Karin惊醒，18岁男性，深栗棕碎发、灰绿色眼睛、墨绿短斗篷、腰后断剑，呼吸尚未平复；Rifa，18岁女性，黑色低侧辫、琥珀眼、炭灰斗篷、暗红围巾，坐在竖向车窗下方，先观察他的呼吸再开口：“又是那个梦？”Karin避开视线：“只是路太颠。”Rifa看一眼平整道路：“当然。石头还学会道歉了。”她把水囊推到画面下方Karin手边。固定双人中景，PM2反应优先，雾蓝灰与皮革棕。口型同步，无字幕、无浪漫凝视、无现代物品、无额外肢体、无脸部融化、无背景漂移。\n本内部镜头只执行：Rifa识破梦境，Karin否认。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "固定双人中景",
          "startFramePrompt": "Rifa识破梦境，Karin否认，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "Karin接住水囊，Rifa移开视线，关系恢复日常\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无浪漫凝视、无现代物品、无额外肢体、无脸部融化、无背景漂移。",
          "continuity": {
            "shotSize": "MS",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按Rifa识破梦境，Karin否认的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "Rifa识破梦境，Karin否认",
            "actionEnd": "Karin接住水囊，Rifa移开视线，关系恢复日常",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "水囊动作切"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02"
          ],
          "propCodes": [
            "P01"
          ],
          "clueCodes": [],
          "locationCode": "S06",
          "storySceneCode": "SC02",
          "timecode": "15-20s",
          "dramaticFunction": "起/关系",
          "lens": "50mm",
          "lighting": "阴天柔光",
          "colorPalette": "雾蓝灰+皮革棕",
          "transitionOut": "水囊动作切",
          "performanceNotes": "又是那个梦？；只是路太颠。；当然。石头还学会道歉了。",
          "performancePlan": {
            "emotionalObjective": "围绕Rifa识破梦境，Karin否认完成当前镜头的外在行动目标",
            "emotionalArc": "从进入Rifa识破梦境，Karin否认的克制状态开始，经由动作反应推进，在Karin接住水囊，Rifa移开视线，关系恢复日常前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入Rifa识破梦境，Karin否认"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "Karin接住水囊，Rifa移开视线，关系恢复日常"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D02",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "又是那个梦？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D03",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "只是路太颠。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D04",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "当然。石头还学会道歉了。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "雾蓝灰+皮革棕",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "阴天柔光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "车轮、马具、木车轻响",
            "soundEffects": "水囊滑过木板、剑鞘摩擦",
            "music": "克制拨弦，保留对白空间"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Karin在马车中惊醒，手扣断剑，呼吸急促"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "进入Rifa识破梦境，Karin否认"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "Karin在马车中惊醒，手扣断剑，呼吸急促",
                "holderId": "C01"
              }
            ],
            "environment": "马车",
            "lighting": "阴天柔光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Rifa识破梦境，Karin否认"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Rifa识破梦境，Karin否认"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "Rifa识破梦境，Karin否认",
                "holderId": "C01"
              }
            ],
            "environment": "马车",
            "lighting": "阴天柔光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH003-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频",
                "imagePrompt": "Rifa识破梦境，Karin否认，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH003-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "延续Karin惊醒，18岁男性，深栗棕碎发、灰绿色眼睛、墨绿短斗篷、腰后断剑，呼吸尚未平复",
                "imagePrompt": "Rifa识破梦境，Karin否认，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：延续Karin惊醒，18岁男性，深栗棕碎发、灰绿色眼睛、墨绿短斗篷、腰后断剑，呼吸尚未平复。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH003-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "Rifa，18岁女性，黑色低侧辫、琥珀眼、炭灰斗篷、暗红围巾，坐在竖向车窗下方，先观察他的呼吸再开口：“又是那个梦？”Karin避开视线：“只是路太颠",
                "imagePrompt": "Rifa识破梦境，Karin否认，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa，18岁女性，黑色低侧辫、琥珀眼、炭灰斗篷、暗红围巾，坐在竖向车窗下方，先观察他的呼吸再开口：“又是那个梦？”Karin避开视线：“只是路太颠。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH003-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "”Rifa看一眼平整道路：“当然",
                "imagePrompt": "Rifa识破梦境，Karin否认，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”Rifa看一眼平整道路：“当然。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH003-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "石头还学会道歉了",
                "imagePrompt": "Rifa识破梦境，Karin否认，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：石头还学会道歉了。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH003-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "”她把水囊推到画面下方Karin手边",
                "imagePrompt": "Rifa识破梦境，Karin否认，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”她把水囊推到画面下方Karin手边。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH003-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "固定双人中景，PM2反应优先，雾蓝灰与皮革棕",
                "imagePrompt": "Rifa识破梦境，Karin否认，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：固定双人中景，PM2反应优先，雾蓝灰与皮革棕。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH003-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "口型同步，无字幕、无浪漫凝视、无现代物品、无额外肢体、无脸部融化、无背景漂移",
                "imagePrompt": "Rifa识破梦境，Karin否认，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：口型同步，无字幕、无浪漫凝视、无现代物品、无额外肢体、无脸部融化、无背景漂移。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH003-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "本内部镜头只执行：Rifa识破梦境，Karin否认",
                "imagePrompt": "Rifa识破梦境，Karin否认，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：Rifa识破梦境，Karin否认。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH002"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Rifa 的身份特征、服装与道具不漂移",
                "assetId": "C02"
              },
              {
                "alias": "@图片4",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S06"
              }
            ]
          }
        },
        {
          "code": "SH004",
          "order": 4,
          "title": "梦醒试探 2/3",
          "description": "梦醒试探的连续反应与动作过渡",
          "sourceText": "Karin的手仍扣在断剑上。Rifa没有追问，先等他的呼吸恢复。\nRifa：“又是那个梦？”\nKarin：“只是路太颠。”\nRifa看一眼平整得过分的皇家道路：“当然。石头还学会道歉了。”\n她把水囊推过去。Karin刚接住，腰间护符忽然闪烁后熄灭。\nRifa：“第几个？”\nKarin：“今天？”\nRifa：“十八岁以后。”\nKarin没有回答。车窗外，皇家结界已经逼近。",
          "shotBoundary": "水囊动作切",
          "dialogue": "Karin：只是路太颠。",
          "narration": "",
          "utterances": [
            {
              "id": "D03",
              "order": 1,
              "type": "dialogue",
              "speaker": "Karin",
              "text": "只是路太颠。"
            }
          ],
          "imagePrompt": "梦醒试探的连续反应与动作过渡，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频。延续Karin惊醒，18岁男性，深栗棕碎发、灰绿色眼睛、墨绿短斗篷、腰后断剑，呼吸尚未平复；Rifa，18岁女性，黑色低侧辫、琥珀眼、炭灰斗篷、暗红围巾，坐在竖向车窗下方，先观察他的呼吸再开口：“又是那个梦？”Karin避开视线：“只是路太颠。”Rifa看一眼平整道路：“当然。石头还学会道歉了。”她把水囊推到画面下方Karin手边。固定双人中景，PM2反应优先，雾蓝灰与皮革棕。口型同步，无字幕、无浪漫凝视、无现代物品、无额外肢体、无脸部融化、无背景漂移。\n本内部镜头只执行：梦醒试探的连续反应与动作过渡。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "固定双人中景",
          "startFramePrompt": "Rifa识破梦境，Karin否认，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "Karin接住水囊，Rifa移开视线，关系恢复日常\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无浪漫凝视、无现代物品、无额外肢体、无脸部融化、无背景漂移。",
          "continuity": {
            "shotSize": "MS",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按Rifa识破梦境，Karin否认的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "Rifa识破梦境，Karin否认",
            "actionEnd": "Karin接住水囊，Rifa移开视线，关系恢复日常",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "水囊动作切"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02"
          ],
          "propCodes": [
            "P01"
          ],
          "clueCodes": [],
          "locationCode": "S06",
          "storySceneCode": "SC02",
          "timecode": "20-25s",
          "dramaticFunction": "起/关系",
          "lens": "50mm",
          "lighting": "阴天柔光",
          "colorPalette": "雾蓝灰+皮革棕",
          "transitionOut": "水囊动作切",
          "performanceNotes": "又是那个梦？；只是路太颠。；当然。石头还学会道歉了。",
          "performancePlan": {
            "emotionalObjective": "围绕Rifa识破梦境，Karin否认完成当前镜头的外在行动目标",
            "emotionalArc": "从进入Rifa识破梦境，Karin否认的克制状态开始，经由动作反应推进，在Karin接住水囊，Rifa移开视线，关系恢复日常前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入Rifa识破梦境，Karin否认"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "Karin接住水囊，Rifa移开视线，关系恢复日常"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D03",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "只是路太颠。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D02",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "又是那个梦？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D04",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "当然。石头还学会道歉了。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "雾蓝灰+皮革棕",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "阴天柔光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "车轮、马具、木车轻响",
            "soundEffects": "水囊滑过木板、剑鞘摩擦",
            "music": "克制拨弦，保留对白空间"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Rifa识破梦境，Karin否认"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Rifa识破梦境，Karin否认"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "Rifa识破梦境，Karin否认",
                "holderId": "C01"
              }
            ],
            "environment": "马车",
            "lighting": "阴天柔光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "梦醒试探的连续反应与动作过渡"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "梦醒试探的连续反应与动作过渡"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "梦醒试探的连续反应与动作过渡",
                "holderId": "C01"
              }
            ],
            "environment": "马车",
            "lighting": "阴天柔光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH004-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频",
                "imagePrompt": "梦醒试探的连续反应与动作过渡，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH004-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "延续Karin惊醒，18岁男性，深栗棕碎发、灰绿色眼睛、墨绿短斗篷、腰后断剑，呼吸尚未平复",
                "imagePrompt": "梦醒试探的连续反应与动作过渡，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：延续Karin惊醒，18岁男性，深栗棕碎发、灰绿色眼睛、墨绿短斗篷、腰后断剑，呼吸尚未平复。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH004-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "Rifa，18岁女性，黑色低侧辫、琥珀眼、炭灰斗篷、暗红围巾，坐在竖向车窗下方，先观察他的呼吸再开口：“又是那个梦？”Karin避开视线：“只是路太颠",
                "imagePrompt": "梦醒试探的连续反应与动作过渡，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa，18岁女性，黑色低侧辫、琥珀眼、炭灰斗篷、暗红围巾，坐在竖向车窗下方，先观察他的呼吸再开口：“又是那个梦？”Karin避开视线：“只是路太颠。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH004-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "”Rifa看一眼平整道路：“当然",
                "imagePrompt": "梦醒试探的连续反应与动作过渡，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”Rifa看一眼平整道路：“当然。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH004-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "石头还学会道歉了",
                "imagePrompt": "梦醒试探的连续反应与动作过渡，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：石头还学会道歉了。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH004-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "”她把水囊推到画面下方Karin手边",
                "imagePrompt": "梦醒试探的连续反应与动作过渡，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”她把水囊推到画面下方Karin手边。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH004-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "固定双人中景，PM2反应优先，雾蓝灰与皮革棕",
                "imagePrompt": "梦醒试探的连续反应与动作过渡，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：固定双人中景，PM2反应优先，雾蓝灰与皮革棕。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH004-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "口型同步，无字幕、无浪漫凝视、无现代物品、无额外肢体、无脸部融化、无背景漂移",
                "imagePrompt": "梦醒试探的连续反应与动作过渡，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：口型同步，无字幕、无浪漫凝视、无现代物品、无额外肢体、无脸部融化、无背景漂移。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH004-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "本内部镜头只执行：梦醒试探的连续反应与动作过渡",
                "imagePrompt": "梦醒试探的连续反应与动作过渡，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：梦醒试探的连续反应与动作过渡。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH003"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Rifa 的身份特征、服装与道具不漂移",
                "assetId": "C02"
              },
              {
                "alias": "@图片4",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S06"
              }
            ]
          }
        },
        {
          "code": "SH005",
          "order": 5,
          "title": "梦醒试探 3/3",
          "description": "Karin接住水囊，Rifa移开视线，关系恢复日常",
          "sourceText": "Karin的手仍扣在断剑上。Rifa没有追问，先等他的呼吸恢复。\nRifa：“又是那个梦？”\nKarin：“只是路太颠。”\nRifa看一眼平整得过分的皇家道路：“当然。石头还学会道歉了。”\n她把水囊推过去。Karin刚接住，腰间护符忽然闪烁后熄灭。\nRifa：“第几个？”\nKarin：“今天？”\nRifa：“十八岁以后。”\nKarin没有回答。车窗外，皇家结界已经逼近。",
          "shotBoundary": "水囊动作切",
          "dialogue": "Rifa：当然。石头还学会道歉了。",
          "narration": "",
          "utterances": [
            {
              "id": "D04",
              "order": 1,
              "type": "dialogue",
              "speaker": "Rifa",
              "text": "当然。石头还学会道歉了。"
            }
          ],
          "imagePrompt": "Karin接住水囊，Rifa移开视线，关系恢复日常，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频。延续Karin惊醒，18岁男性，深栗棕碎发、灰绿色眼睛、墨绿短斗篷、腰后断剑，呼吸尚未平复；Rifa，18岁女性，黑色低侧辫、琥珀眼、炭灰斗篷、暗红围巾，坐在竖向车窗下方，先观察他的呼吸再开口：“又是那个梦？”Karin避开视线：“只是路太颠。”Rifa看一眼平整道路：“当然。石头还学会道歉了。”她把水囊推到画面下方Karin手边。固定双人中景，PM2反应优先，雾蓝灰与皮革棕。口型同步，无字幕、无浪漫凝视、无现代物品、无额外肢体、无脸部融化、无背景漂移。\n本内部镜头只执行：Karin接住水囊，Rifa移开视线，关系恢复日常。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "固定双人中景",
          "startFramePrompt": "Rifa识破梦境，Karin否认，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "Karin接住水囊，Rifa移开视线，关系恢复日常\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无浪漫凝视、无现代物品、无额外肢体、无脸部融化、无背景漂移。",
          "continuity": {
            "shotSize": "MS",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按Rifa识破梦境，Karin否认的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "Rifa识破梦境，Karin否认",
            "actionEnd": "Karin接住水囊，Rifa移开视线，关系恢复日常",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "水囊动作切"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02"
          ],
          "propCodes": [
            "P01"
          ],
          "clueCodes": [],
          "locationCode": "S06",
          "storySceneCode": "SC02",
          "timecode": "25-30s",
          "dramaticFunction": "起/关系",
          "lens": "50mm",
          "lighting": "阴天柔光",
          "colorPalette": "雾蓝灰+皮革棕",
          "transitionOut": "水囊动作切",
          "performanceNotes": "又是那个梦？；只是路太颠。；当然。石头还学会道歉了。",
          "performancePlan": {
            "emotionalObjective": "围绕Rifa识破梦境，Karin否认完成当前镜头的外在行动目标",
            "emotionalArc": "从进入Rifa识破梦境，Karin否认的克制状态开始，经由动作反应推进，在Karin接住水囊，Rifa移开视线，关系恢复日常前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入Rifa识破梦境，Karin否认"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "Karin接住水囊，Rifa移开视线，关系恢复日常"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D04",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "当然。石头还学会道歉了。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D02",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "又是那个梦？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D03",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "只是路太颠。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "雾蓝灰+皮革棕",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "阴天柔光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "车轮、马具、木车轻响",
            "soundEffects": "水囊滑过木板、剑鞘摩擦",
            "music": "克制拨弦，保留对白空间"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "梦醒试探的连续反应与动作过渡"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "梦醒试探的连续反应与动作过渡"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "梦醒试探的连续反应与动作过渡",
                "holderId": "C01"
              }
            ],
            "environment": "马车",
            "lighting": "阴天柔光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Karin接住水囊，Rifa移开视线，关系恢复日常"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Karin接住水囊，Rifa移开视线，关系恢复日常"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "Karin接住水囊，Rifa移开视线，关系恢复日常",
                "holderId": "C01"
              }
            ],
            "environment": "马车",
            "lighting": "阴天柔光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH005-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频",
                "imagePrompt": "Karin接住水囊，Rifa移开视线，关系恢复日常，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH005-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "延续Karin惊醒，18岁男性，深栗棕碎发、灰绿色眼睛、墨绿短斗篷、腰后断剑，呼吸尚未平复",
                "imagePrompt": "Karin接住水囊，Rifa移开视线，关系恢复日常，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：延续Karin惊醒，18岁男性，深栗棕碎发、灰绿色眼睛、墨绿短斗篷、腰后断剑，呼吸尚未平复。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH005-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "Rifa，18岁女性，黑色低侧辫、琥珀眼、炭灰斗篷、暗红围巾，坐在竖向车窗下方，先观察他的呼吸再开口：“又是那个梦？”Karin避开视线：“只是路太颠",
                "imagePrompt": "Karin接住水囊，Rifa移开视线，关系恢复日常，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa，18岁女性，黑色低侧辫、琥珀眼、炭灰斗篷、暗红围巾，坐在竖向车窗下方，先观察他的呼吸再开口：“又是那个梦？”Karin避开视线：“只是路太颠。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH005-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "”Rifa看一眼平整道路：“当然",
                "imagePrompt": "Karin接住水囊，Rifa移开视线，关系恢复日常，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”Rifa看一眼平整道路：“当然。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH005-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "石头还学会道歉了",
                "imagePrompt": "Karin接住水囊，Rifa移开视线，关系恢复日常，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：石头还学会道歉了。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH005-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "”她把水囊推到画面下方Karin手边",
                "imagePrompt": "Karin接住水囊，Rifa移开视线，关系恢复日常，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”她把水囊推到画面下方Karin手边。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH005-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "固定双人中景，PM2反应优先，雾蓝灰与皮革棕",
                "imagePrompt": "Karin接住水囊，Rifa移开视线，关系恢复日常，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：固定双人中景，PM2反应优先，雾蓝灰与皮革棕。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH005-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "口型同步，无字幕、无浪漫凝视、无现代物品、无额外肢体、无脸部融化、无背景漂移",
                "imagePrompt": "Karin接住水囊，Rifa移开视线，关系恢复日常，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：口型同步，无字幕、无浪漫凝视、无现代物品、无额外肢体、无脸部融化、无背景漂移。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH005-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "本内部镜头只执行：Karin接住水囊，Rifa移开视线，关系恢复日常",
                "imagePrompt": "Karin接住水囊，Rifa移开视线，关系恢复日常，MS，阴天柔光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：Karin接住水囊，Rifa移开视线，关系恢复日常。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH004"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Rifa 的身份特征、服装与道具不漂移",
                "assetId": "C02"
              },
              {
                "alias": "@图片4",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S06"
              }
            ]
          }
        },
        {
          "code": "SH006",
          "order": 6,
          "title": "第几个 1/2",
          "description": "护符失灵，结界逼近",
          "sourceText": "Karin的手仍扣在断剑上。Rifa没有追问，先等他的呼吸恢复。\nRifa：“又是那个梦？”\nKarin：“只是路太颠。”\nRifa看一眼平整得过分的皇家道路：“当然。石头还学会道歉了。”\n她把水囊推过去。Karin刚接住，腰间护符忽然闪烁后熄灭。\nRifa：“第几个？”\nKarin：“今天？”\nRifa：“十八岁以后。”\nKarin没有回答。车窗外，皇家结界已经逼近。",
          "shotBoundary": "护符熄灭切",
          "dialogue": "Rifa：第几个？\nKarin：今天？",
          "narration": "",
          "utterances": [
            {
              "id": "D05",
              "order": 1,
              "type": "dialogue",
              "speaker": "Rifa",
              "text": "第几个？"
            },
            {
              "id": "D06",
              "order": 2,
              "type": "dialogue",
              "speaker": "Karin",
              "text": "今天？"
            }
          ],
          "imagePrompt": "护符失灵，结界逼近，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频。Karin接住水囊时，腰间黄铜护符闪烁后熄灭。Rifa的调侃消失，低声问：“第几个？”Karin拖延：“今天？”Rifa只答：“十八岁以后。”停顿两秒，她不逼问，转头看向车窗外占满竖幅的透明皇家结界与高耸双塔。镜头从护符特写缓慢后拉到两人上下错落的中景，暖棕逐渐被冷银覆盖。结尾Karin握住熄灭护符，Rifa警觉看向结界。口型同步，无字幕、无科技扫描、无雷电爆炸、无角色变形、无背景漂移。\n本内部镜头只执行：护符失灵，结界逼近。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "车内慢拉",
          "startFramePrompt": "护符失灵，结界逼近，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "Karin握住护符，Rifa望向结界，二人警觉\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无科技扫描、无雷电爆炸、无角色变形、无背景漂移。",
          "continuity": {
            "shotSize": "MCU→LS",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按护符失灵，结界逼近的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "护符失灵，结界逼近",
            "actionEnd": "Karin握住护符，Rifa望向结界，二人警觉",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "护符熄灭切"
          },
          "duration": 7.5,
          "characterCodes": [
            "C01",
            "C02"
          ],
          "propCodes": [
            "P02"
          ],
          "clueCodes": [],
          "locationCode": "S06",
          "storySceneCode": "SC02",
          "timecode": "30-37.5s",
          "dramaticFunction": "起/异常",
          "lens": "65mm",
          "lighting": "柔光转结界冷光",
          "colorPalette": "暖棕→冷银",
          "transitionOut": "护符熄灭切",
          "performanceNotes": "第几个？；今天？；十八岁以后。",
          "performancePlan": {
            "emotionalObjective": "围绕护符失灵，结界逼近完成当前镜头的外在行动目标",
            "emotionalArc": "从进入护符失灵，结界逼近的克制状态开始，经由动作反应推进，在Karin握住护符，Rifa望向结界，二人警觉前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入护符失灵，结界逼近"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "Karin握住护符，Rifa望向结界，二人警觉"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D05",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "第几个？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D06",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "今天？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D07",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "十八岁以后。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "暖棕→冷银",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "柔光转结界冷光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "车轮渐弱、结界远鸣",
            "soundEffects": "护符闪烁后熄灭",
            "music": "两音母题低声回归"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Karin接住水囊，Rifa移开视线，关系恢复日常"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Karin接住水囊，Rifa移开视线，关系恢复日常"
              }
            ],
            "props": [
              {
                "assetId": "P02",
                "state": "进入护符失灵，结界逼近",
                "holderId": "C01"
              }
            ],
            "environment": "马车",
            "lighting": "柔光转结界冷光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "护符失灵，结界逼近"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "护符失灵，结界逼近"
              }
            ],
            "props": [
              {
                "assetId": "P02",
                "state": "护符失灵，结界逼近",
                "holderId": "C01"
              }
            ],
            "environment": "马车",
            "lighting": "柔光转结界冷光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH006-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.833,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频",
                "imagePrompt": "护符失灵，结界逼近，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH006-F02",
                "sequenceIndex": 2,
                "startSecond": 0.833,
                "endSecond": 1.667,
                "actionPrompt": "Karin接住水囊时，腰间黄铜护符闪烁后熄灭",
                "imagePrompt": "护符失灵，结界逼近，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin接住水囊时，腰间黄铜护符闪烁后熄灭。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH006-F03",
                "sequenceIndex": 3,
                "startSecond": 1.667,
                "endSecond": 2.5,
                "actionPrompt": "Rifa的调侃消失，低声问：“第几个？”Karin拖延：“今天？”Rifa只答：“十八岁以后",
                "imagePrompt": "护符失灵，结界逼近，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa的调侃消失，低声问：“第几个？”Karin拖延：“今天？”Rifa只答：“十八岁以后。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH006-F04",
                "sequenceIndex": 4,
                "startSecond": 2.5,
                "endSecond": 3.333,
                "actionPrompt": "”停顿两秒，她不逼问，转头看向车窗外占满竖幅的透明皇家结界与高耸双塔",
                "imagePrompt": "护符失灵，结界逼近，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”停顿两秒，她不逼问，转头看向车窗外占满竖幅的透明皇家结界与高耸双塔。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH006-F05",
                "sequenceIndex": 5,
                "startSecond": 3.333,
                "endSecond": 4.167,
                "actionPrompt": "镜头从护符特写缓慢后拉到两人上下错落的中景，暖棕逐渐被冷银覆盖",
                "imagePrompt": "护符失灵，结界逼近，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：镜头从护符特写缓慢后拉到两人上下错落的中景，暖棕逐渐被冷银覆盖。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH006-F06",
                "sequenceIndex": 6,
                "startSecond": 4.167,
                "endSecond": 5,
                "actionPrompt": "结尾Karin握住熄灭护符，Rifa警觉看向结界",
                "imagePrompt": "护符失灵，结界逼近，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：结尾Karin握住熄灭护符，Rifa警觉看向结界。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH006-F07",
                "sequenceIndex": 7,
                "startSecond": 5,
                "endSecond": 5.833,
                "actionPrompt": "口型同步，无字幕、无科技扫描、无雷电爆炸、无角色变形、无背景漂移",
                "imagePrompt": "护符失灵，结界逼近，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：口型同步，无字幕、无科技扫描、无雷电爆炸、无角色变形、无背景漂移。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH006-F08",
                "sequenceIndex": 8,
                "startSecond": 5.833,
                "endSecond": 6.667,
                "actionPrompt": "本内部镜头只执行：护符失灵，结界逼近",
                "imagePrompt": "护符失灵，结界逼近，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：护符失灵，结界逼近。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH006-F09",
                "sequenceIndex": 9,
                "startSecond": 6.667,
                "endSecond": 7.5,
                "actionPrompt": "保持角色、道具、轴线和前后状态连续",
                "imagePrompt": "护符失灵，结界逼近，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：保持角色、道具、轴线和前后状态连续。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH005"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Rifa 的身份特征、服装与道具不漂移",
                "assetId": "C02"
              },
              {
                "alias": "@图片4",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S06"
              }
            ]
          }
        },
        {
          "code": "SH007",
          "order": 7,
          "title": "第几个 2/2",
          "description": "Karin握住护符，Rifa望向结界，二人警觉",
          "sourceText": "Karin的手仍扣在断剑上。Rifa没有追问，先等他的呼吸恢复。\nRifa：“又是那个梦？”\nKarin：“只是路太颠。”\nRifa看一眼平整得过分的皇家道路：“当然。石头还学会道歉了。”\n她把水囊推过去。Karin刚接住，腰间护符忽然闪烁后熄灭。\nRifa：“第几个？”\nKarin：“今天？”\nRifa：“十八岁以后。”\nKarin没有回答。车窗外，皇家结界已经逼近。",
          "shotBoundary": "护符熄灭切",
          "dialogue": "Rifa：十八岁以后。",
          "narration": "",
          "utterances": [
            {
              "id": "D07",
              "order": 1,
              "type": "dialogue",
              "speaker": "Rifa",
              "text": "十八岁以后。"
            }
          ],
          "imagePrompt": "Karin握住护符，Rifa望向结界，二人警觉，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频。Karin接住水囊时，腰间黄铜护符闪烁后熄灭。Rifa的调侃消失，低声问：“第几个？”Karin拖延：“今天？”Rifa只答：“十八岁以后。”停顿两秒，她不逼问，转头看向车窗外占满竖幅的透明皇家结界与高耸双塔。镜头从护符特写缓慢后拉到两人上下错落的中景，暖棕逐渐被冷银覆盖。结尾Karin握住熄灭护符，Rifa警觉看向结界。口型同步，无字幕、无科技扫描、无雷电爆炸、无角色变形、无背景漂移。\n本内部镜头只执行：Karin握住护符，Rifa望向结界，二人警觉。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "车内慢拉",
          "startFramePrompt": "护符失灵，结界逼近，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "Karin握住护符，Rifa望向结界，二人警觉\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无科技扫描、无雷电爆炸、无角色变形、无背景漂移。",
          "continuity": {
            "shotSize": "MCU→LS",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按护符失灵，结界逼近的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "护符失灵，结界逼近",
            "actionEnd": "Karin握住护符，Rifa望向结界，二人警觉",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "护符熄灭切"
          },
          "duration": 7.5,
          "characterCodes": [
            "C01",
            "C02"
          ],
          "propCodes": [
            "P02"
          ],
          "clueCodes": [],
          "locationCode": "S06",
          "storySceneCode": "SC02",
          "timecode": "37.5-45s",
          "dramaticFunction": "起/异常",
          "lens": "65mm",
          "lighting": "柔光转结界冷光",
          "colorPalette": "暖棕→冷银",
          "transitionOut": "护符熄灭切",
          "performanceNotes": "第几个？；今天？；十八岁以后。",
          "performancePlan": {
            "emotionalObjective": "围绕护符失灵，结界逼近完成当前镜头的外在行动目标",
            "emotionalArc": "从进入护符失灵，结界逼近的克制状态开始，经由动作反应推进，在Karin握住护符，Rifa望向结界，二人警觉前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入护符失灵，结界逼近"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "Karin握住护符，Rifa望向结界，二人警觉"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D07",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "十八岁以后。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D05",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "第几个？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D06",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "今天？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "暖棕→冷银",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "柔光转结界冷光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "车轮渐弱、结界远鸣",
            "soundEffects": "护符闪烁后熄灭",
            "music": "两音母题低声回归"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "护符失灵，结界逼近"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "护符失灵，结界逼近"
              }
            ],
            "props": [
              {
                "assetId": "P02",
                "state": "护符失灵，结界逼近",
                "holderId": "C01"
              }
            ],
            "environment": "马车",
            "lighting": "柔光转结界冷光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Karin握住护符，Rifa望向结界，二人警觉"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Karin握住护符，Rifa望向结界，二人警觉"
              }
            ],
            "props": [
              {
                "assetId": "P02",
                "state": "Karin握住护符，Rifa望向结界，二人警觉",
                "holderId": "C01"
              }
            ],
            "environment": "马车",
            "lighting": "柔光转结界冷光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH007-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.833,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频",
                "imagePrompt": "Karin握住护符，Rifa望向结界，二人警觉，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH007-F02",
                "sequenceIndex": 2,
                "startSecond": 0.833,
                "endSecond": 1.667,
                "actionPrompt": "Karin接住水囊时，腰间黄铜护符闪烁后熄灭",
                "imagePrompt": "Karin握住护符，Rifa望向结界，二人警觉，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin接住水囊时，腰间黄铜护符闪烁后熄灭。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH007-F03",
                "sequenceIndex": 3,
                "startSecond": 1.667,
                "endSecond": 2.5,
                "actionPrompt": "Rifa的调侃消失，低声问：“第几个？”Karin拖延：“今天？”Rifa只答：“十八岁以后",
                "imagePrompt": "Karin握住护符，Rifa望向结界，二人警觉，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa的调侃消失，低声问：“第几个？”Karin拖延：“今天？”Rifa只答：“十八岁以后。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH007-F04",
                "sequenceIndex": 4,
                "startSecond": 2.5,
                "endSecond": 3.333,
                "actionPrompt": "”停顿两秒，她不逼问，转头看向车窗外占满竖幅的透明皇家结界与高耸双塔",
                "imagePrompt": "Karin握住护符，Rifa望向结界，二人警觉，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”停顿两秒，她不逼问，转头看向车窗外占满竖幅的透明皇家结界与高耸双塔。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH007-F05",
                "sequenceIndex": 5,
                "startSecond": 3.333,
                "endSecond": 4.167,
                "actionPrompt": "镜头从护符特写缓慢后拉到两人上下错落的中景，暖棕逐渐被冷银覆盖",
                "imagePrompt": "Karin握住护符，Rifa望向结界，二人警觉，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：镜头从护符特写缓慢后拉到两人上下错落的中景，暖棕逐渐被冷银覆盖。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH007-F06",
                "sequenceIndex": 6,
                "startSecond": 4.167,
                "endSecond": 5,
                "actionPrompt": "结尾Karin握住熄灭护符，Rifa警觉看向结界",
                "imagePrompt": "Karin握住护符，Rifa望向结界，二人警觉，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：结尾Karin握住熄灭护符，Rifa警觉看向结界。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH007-F07",
                "sequenceIndex": 7,
                "startSecond": 5,
                "endSecond": 5.833,
                "actionPrompt": "口型同步，无字幕、无科技扫描、无雷电爆炸、无角色变形、无背景漂移",
                "imagePrompt": "Karin握住护符，Rifa望向结界，二人警觉，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：口型同步，无字幕、无科技扫描、无雷电爆炸、无角色变形、无背景漂移。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH007-F08",
                "sequenceIndex": 8,
                "startSecond": 5.833,
                "endSecond": 6.667,
                "actionPrompt": "本内部镜头只执行：Karin握住护符，Rifa望向结界，二人警觉",
                "imagePrompt": "Karin握住护符，Rifa望向结界，二人警觉，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：Karin握住护符，Rifa望向结界，二人警觉。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH007-F09",
                "sequenceIndex": 9,
                "startSecond": 6.667,
                "endSecond": 7.5,
                "actionPrompt": "保持角色、道具、轴线和前后状态连续",
                "imagePrompt": "Karin握住护符，Rifa望向结界，二人警觉，MCU→LS，柔光转结界冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：保持角色、道具、轴线和前后状态连续。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH006"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Rifa 的身份特征、服装与道具不漂移",
                "assetId": "C02"
              },
              {
                "alias": "@图片4",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S06"
              }
            ]
          }
        },
        {
          "code": "SH008",
          "order": 8,
          "title": "跨越结界 1/2",
          "description": "穿过结界，法师注视",
          "sourceText": "马车穿过水波般的结界，高塔法师同时转头。检查官把黄铜探测器依次对准Karin与Rifa，指针死死停在零。\n检查官：“没有灵压，却带着Mahadel的徽记。”\nRifa：“你可以说我们很有礼貌。”\n检查官抬手，闸门锁链落下：“也可以说，你们在隐藏危险。”\nKarin向前半步，挡住检查官看向Rifa的视线。\nKarin：“我们只是来修一把剑。”",
          "shotBoundary": "指针匹配切",
          "dialogue": "",
          "narration": "",
          "utterances": [],
          "imagePrompt": "穿过结界，法师注视，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频。延续护符熄灭，马车从画面底部驶向高耸的阿佐雷斯双塔城门，穿过透明水波状皇家结界，冷银光自上而下扫过Karin与Rifa，高塔法师剪影同时低头。镜头在道路前方稳定后退，竖屏突出双塔高度；马车停下，二人下车站到检查台，铁灰短发、深蓝制服、银肩扣的检查官从前景举起黄铜探测器，指针归零。结尾停在零刻度特写。无对白，无字幕、无现代检查设备、无枪械、无HUD、无雷电爆炸、无角色变形。\n本内部镜头只执行：穿过结界，法师注视。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "前向跟车",
          "startFramePrompt": "穿过结界，法师注视，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "二人站在检查台前，探测器举起\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无现代检查设备、无枪械、无HUD、无雷电爆炸、无角色变形。",
          "continuity": {
            "shotSize": "LS→MCU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按穿过结界，法师注视的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "穿过结界，法师注视",
            "actionEnd": "二人站在检查台前，探测器举起",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "指针匹配切"
          },
          "duration": 7.5,
          "characterCodes": [
            "C01",
            "C02",
            "C05"
          ],
          "propCodes": [
            "P02",
            "P03"
          ],
          "clueCodes": [],
          "locationCode": "S02",
          "storySceneCode": "SC03",
          "timecode": "45-52.5s",
          "dramaticFunction": "承/门槛",
          "lens": "35mm",
          "lighting": "结界折射天光",
          "colorPalette": "冷银+暗蓝",
          "transitionOut": "指针匹配切",
          "performancePlan": {
            "emotionalObjective": "围绕穿过结界，法师注视完成当前镜头的外在行动目标",
            "emotionalArc": "从进入穿过结界，法师注视的克制状态开始，经由动作反应推进，在二人站在检查台前，探测器举起前收束",
            "speechStyle": "无对白，以呼吸、视线和动作反应传递情绪",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入穿过结界，法师注视"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "二人站在检查台前，探测器举起"
              }
            }
          },
          "dialoguePerformance": [],
          "lightingPlan": {
            "palette": "冷银+暗蓝",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "结界折射天光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "风穿结界、远钟",
            "soundEffects": "透明波纹、探测器启动",
            "music": "低弦持续音进入"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Karin握住护符，Rifa望向结界，二人警觉"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Karin握住护符，Rifa望向结界，二人警觉"
              },
              {
                "assetId": "C05",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "进入穿过结界，法师注视"
              }
            ],
            "props": [
              {
                "assetId": "P02",
                "state": "Karin握住护符，Rifa望向结界，二人警觉",
                "holderId": "C01"
              },
              {
                "assetId": "P03",
                "state": "进入穿过结界，法师注视",
                "holderId": "C05"
              }
            ],
            "environment": "城门盘查",
            "lighting": "结界折射天光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "穿过结界，法师注视"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "穿过结界，法师注视"
              },
              {
                "assetId": "C05",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "穿过结界，法师注视"
              }
            ],
            "props": [
              {
                "assetId": "P02",
                "state": "穿过结界，法师注视",
                "holderId": "C01"
              },
              {
                "assetId": "P03",
                "state": "穿过结界，法师注视",
                "holderId": "C05"
              }
            ],
            "environment": "城门盘查",
            "lighting": "结界折射天光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH008-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.938,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频",
                "imagePrompt": "穿过结界，法师注视，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH008-F02",
                "sequenceIndex": 2,
                "startSecond": 0.938,
                "endSecond": 1.875,
                "actionPrompt": "延续护符熄灭，马车从画面底部驶向高耸的阿佐雷斯双塔城门，穿过透明水波状皇家结界，冷银光自上而下扫过Karin与Rifa，高塔法师剪影同时低头",
                "imagePrompt": "穿过结界，法师注视，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：延续护符熄灭，马车从画面底部驶向高耸的阿佐雷斯双塔城门，穿过透明水波状皇家结界，冷银光自上而下扫过Karin与Rifa，高塔法师剪影同时低头。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH008-F03",
                "sequenceIndex": 3,
                "startSecond": 1.875,
                "endSecond": 2.813,
                "actionPrompt": "镜头在道路前方稳定后退，竖屏突出双塔高度",
                "imagePrompt": "穿过结界，法师注视，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：镜头在道路前方稳定后退，竖屏突出双塔高度。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH008-F04",
                "sequenceIndex": 4,
                "startSecond": 2.813,
                "endSecond": 3.75,
                "actionPrompt": "马车停下，二人下车站到检查台，铁灰短发、深蓝制服、银肩扣的检查官从前景举起黄铜探测器，指针归零",
                "imagePrompt": "穿过结界，法师注视，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：马车停下，二人下车站到检查台，铁灰短发、深蓝制服、银肩扣的检查官从前景举起黄铜探测器，指针归零。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH008-F05",
                "sequenceIndex": 5,
                "startSecond": 3.75,
                "endSecond": 4.688,
                "actionPrompt": "结尾停在零刻度特写",
                "imagePrompt": "穿过结界，法师注视，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：结尾停在零刻度特写。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH008-F06",
                "sequenceIndex": 6,
                "startSecond": 4.688,
                "endSecond": 5.625,
                "actionPrompt": "无对白，无字幕、无现代检查设备、无枪械、无HUD、无雷电爆炸、无角色变形",
                "imagePrompt": "穿过结界，法师注视，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：无对白，无字幕、无现代检查设备、无枪械、无HUD、无雷电爆炸、无角色变形。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH008-F07",
                "sequenceIndex": 7,
                "startSecond": 5.625,
                "endSecond": 6.563,
                "actionPrompt": "本内部镜头只执行：穿过结界，法师注视",
                "imagePrompt": "穿过结界，法师注视，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：穿过结界，法师注视。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH008-F08",
                "sequenceIndex": 8,
                "startSecond": 6.563,
                "endSecond": 7.5,
                "actionPrompt": "保持角色、道具、轴线和前后状态连续",
                "imagePrompt": "穿过结界，法师注视，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：保持角色、道具、轴线和前后状态连续。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH007"
              },
              {
                "alias": "@图片2",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S02"
              },
              {
                "alias": "@图片3",
                "role": "action_keyframe",
                "purpose": "动作关键帧：由本镜入口状态与动作起点派生，生成前需完成关键帧验收",
                "shotId": "SH008"
              }
            ]
          }
        },
        {
          "code": "SH009",
          "order": 9,
          "title": "跨越结界 2/2",
          "description": "二人站在检查台前，探测器举起",
          "sourceText": "马车穿过水波般的结界，高塔法师同时转头。检查官把黄铜探测器依次对准Karin与Rifa，指针死死停在零。\n检查官：“没有灵压，却带着Mahadel的徽记。”\nRifa：“你可以说我们很有礼貌。”\n检查官抬手，闸门锁链落下：“也可以说，你们在隐藏危险。”\nKarin向前半步，挡住检查官看向Rifa的视线。\nKarin：“我们只是来修一把剑。”",
          "shotBoundary": "指针匹配切",
          "dialogue": "",
          "narration": "",
          "utterances": [],
          "imagePrompt": "二人站在检查台前，探测器举起，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频。延续护符熄灭，马车从画面底部驶向高耸的阿佐雷斯双塔城门，穿过透明水波状皇家结界，冷银光自上而下扫过Karin与Rifa，高塔法师剪影同时低头。镜头在道路前方稳定后退，竖屏突出双塔高度；马车停下，二人下车站到检查台，铁灰短发、深蓝制服、银肩扣的检查官从前景举起黄铜探测器，指针归零。结尾停在零刻度特写。无对白，无字幕、无现代检查设备、无枪械、无HUD、无雷电爆炸、无角色变形。\n本内部镜头只执行：二人站在检查台前，探测器举起。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "前向跟车",
          "startFramePrompt": "穿过结界，法师注视，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "二人站在检查台前，探测器举起\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无现代检查设备、无枪械、无HUD、无雷电爆炸、无角色变形。",
          "continuity": {
            "shotSize": "LS→MCU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按穿过结界，法师注视的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "穿过结界，法师注视",
            "actionEnd": "二人站在检查台前，探测器举起",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "指针匹配切"
          },
          "duration": 7.5,
          "characterCodes": [
            "C01",
            "C02",
            "C05"
          ],
          "propCodes": [
            "P02",
            "P03"
          ],
          "clueCodes": [],
          "locationCode": "S02",
          "storySceneCode": "SC03",
          "timecode": "52.5-60s",
          "dramaticFunction": "承/门槛",
          "lens": "35mm",
          "lighting": "结界折射天光",
          "colorPalette": "冷银+暗蓝",
          "transitionOut": "指针匹配切",
          "performancePlan": {
            "emotionalObjective": "围绕穿过结界，法师注视完成当前镜头的外在行动目标",
            "emotionalArc": "从进入穿过结界，法师注视的克制状态开始，经由动作反应推进，在二人站在检查台前，探测器举起前收束",
            "speechStyle": "无对白，以呼吸、视线和动作反应传递情绪",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入穿过结界，法师注视"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "二人站在检查台前，探测器举起"
              }
            }
          },
          "dialoguePerformance": [],
          "lightingPlan": {
            "palette": "冷银+暗蓝",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "结界折射天光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "风穿结界、远钟",
            "soundEffects": "透明波纹、探测器启动",
            "music": "低弦持续音进入"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "穿过结界，法师注视"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "穿过结界，法师注视"
              },
              {
                "assetId": "C05",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "穿过结界，法师注视"
              }
            ],
            "props": [
              {
                "assetId": "P02",
                "state": "穿过结界，法师注视",
                "holderId": "C01"
              },
              {
                "assetId": "P03",
                "state": "穿过结界，法师注视",
                "holderId": "C05"
              }
            ],
            "environment": "城门盘查",
            "lighting": "结界折射天光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人站在检查台前，探测器举起"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人站在检查台前，探测器举起"
              },
              {
                "assetId": "C05",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人站在检查台前，探测器举起"
              }
            ],
            "props": [
              {
                "assetId": "P02",
                "state": "二人站在检查台前，探测器举起",
                "holderId": "C01"
              },
              {
                "assetId": "P03",
                "state": "二人站在检查台前，探测器举起",
                "holderId": "C05"
              }
            ],
            "environment": "城门盘查",
            "lighting": "结界折射天光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH009-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.938,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频",
                "imagePrompt": "二人站在检查台前，探测器举起，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH009-F02",
                "sequenceIndex": 2,
                "startSecond": 0.938,
                "endSecond": 1.875,
                "actionPrompt": "延续护符熄灭，马车从画面底部驶向高耸的阿佐雷斯双塔城门，穿过透明水波状皇家结界，冷银光自上而下扫过Karin与Rifa，高塔法师剪影同时低头",
                "imagePrompt": "二人站在检查台前，探测器举起，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：延续护符熄灭，马车从画面底部驶向高耸的阿佐雷斯双塔城门，穿过透明水波状皇家结界，冷银光自上而下扫过Karin与Rifa，高塔法师剪影同时低头。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH009-F03",
                "sequenceIndex": 3,
                "startSecond": 1.875,
                "endSecond": 2.813,
                "actionPrompt": "镜头在道路前方稳定后退，竖屏突出双塔高度",
                "imagePrompt": "二人站在检查台前，探测器举起，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：镜头在道路前方稳定后退，竖屏突出双塔高度。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH009-F04",
                "sequenceIndex": 4,
                "startSecond": 2.813,
                "endSecond": 3.75,
                "actionPrompt": "马车停下，二人下车站到检查台，铁灰短发、深蓝制服、银肩扣的检查官从前景举起黄铜探测器，指针归零",
                "imagePrompt": "二人站在检查台前，探测器举起，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：马车停下，二人下车站到检查台，铁灰短发、深蓝制服、银肩扣的检查官从前景举起黄铜探测器，指针归零。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH009-F05",
                "sequenceIndex": 5,
                "startSecond": 3.75,
                "endSecond": 4.688,
                "actionPrompt": "结尾停在零刻度特写",
                "imagePrompt": "二人站在检查台前，探测器举起，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：结尾停在零刻度特写。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH009-F06",
                "sequenceIndex": 6,
                "startSecond": 4.688,
                "endSecond": 5.625,
                "actionPrompt": "无对白，无字幕、无现代检查设备、无枪械、无HUD、无雷电爆炸、无角色变形",
                "imagePrompt": "二人站在检查台前，探测器举起，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：无对白，无字幕、无现代检查设备、无枪械、无HUD、无雷电爆炸、无角色变形。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH009-F07",
                "sequenceIndex": 7,
                "startSecond": 5.625,
                "endSecond": 6.563,
                "actionPrompt": "本内部镜头只执行：二人站在检查台前，探测器举起",
                "imagePrompt": "二人站在检查台前，探测器举起，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：二人站在检查台前，探测器举起。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH009-F08",
                "sequenceIndex": 8,
                "startSecond": 6.563,
                "endSecond": 7.5,
                "actionPrompt": "保持角色、道具、轴线和前后状态连续",
                "imagePrompt": "二人站在检查台前，探测器举起，LS→MCU，结界折射天光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：保持角色、道具、轴线和前后状态连续。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH008"
              },
              {
                "alias": "@图片2",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S02"
              },
              {
                "alias": "@图片3",
                "role": "action_keyframe",
                "purpose": "动作关键帧：由本镜入口状态与动作起点派生，生成前需完成关键帧验收",
                "shotId": "SH009"
              }
            ]
          }
        },
        {
          "code": "SH010",
          "order": 10,
          "title": "空白读数 1/3",
          "description": "空白读数与封锁",
          "sourceText": "马车穿过水波般的结界，高塔法师同时转头。检查官把黄铜探测器依次对准Karin与Rifa，指针死死停在零。\n检查官：“没有灵压，却带着Mahadel的徽记。”\nRifa：“你可以说我们很有礼貌。”\n检查官抬手，闸门锁链落下：“也可以说，你们在隐藏危险。”\nKarin向前半步，挡住检查官看向Rifa的视线。\nKarin：“我们只是来修一把剑。”",
          "shotBoundary": "锁链硬切",
          "dialogue": "检查官：没有灵压，却带着Mahadel的徽记。\nRifa：你可以说我们很有礼貌。",
          "narration": "",
          "utterances": [
            {
              "id": "D08",
              "order": 1,
              "type": "dialogue",
              "speaker": "检查官",
              "text": "没有灵压，却带着Mahadel的徽记。"
            },
            {
              "id": "D09",
              "order": 2,
              "type": "dialogue",
              "speaker": "Rifa",
              "text": "你可以说我们很有礼貌。"
            }
          ],
          "imagePrompt": "空白读数与封锁，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频。城门检查台固定正反打，探测器对准Karin和Rifa仍为零。检查官说：“没有灵压，却带着Mahadel的徽记。”Rifa平静回应：“你可以说我们很有礼貌。”检查官抬手，竖幅上方闸门锁链落下：“也可以说，你们在隐藏危险。”Karin向前半步挡住检查官看向Rifa的视线：“我们只是来修一把剑。”Karin在前景、Rifa在中景、双塔法师在高处远景，冷灰与暗红。口型同步，无字幕、无现代检查站、无夸张表演、无魔法光球、无角色变形。\n本内部镜头只执行：空白读数与封锁。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "固定正反打",
          "startFramePrompt": "空白读数与封锁，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "Karin前移半步，Rifa侧后，闸门锁闭\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无现代检查站、无夸张表演、无魔法光球、无角色变形。",
          "continuity": {
            "shotSize": "OTS/MCU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按空白读数与封锁的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "空白读数与封锁",
            "actionEnd": "Karin前移半步，Rifa侧后，闸门锁闭",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "锁链硬切"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02",
            "C05"
          ],
          "propCodes": [
            "P03"
          ],
          "clueCodes": [],
          "locationCode": "S02",
          "storySceneCode": "SC03",
          "timecode": "60-65s",
          "dramaticFunction": "承/盘查",
          "lens": "65mm",
          "lighting": "城门侧光",
          "colorPalette": "冷灰+暗红",
          "transitionOut": "锁链硬切",
          "performanceNotes": "没有灵压，却带着Mahadel的徽记。；你可以说我们很有礼貌。；也可以说，你们在隐藏危险。；我们只是来修一把剑。",
          "performancePlan": {
            "emotionalObjective": "围绕空白读数与封锁完成当前镜头的外在行动目标",
            "emotionalArc": "从进入空白读数与封锁的克制状态开始，经由动作反应推进，在Karin前移半步，Rifa侧后，闸门锁闭前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入空白读数与封锁"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "Karin前移半步，Rifa侧后，闸门锁闭"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D08",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "没有灵压，却带着Mahadel的徽记。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D09",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "你可以说我们很有礼貌。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D10",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "也可以说，你们在隐藏危险。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D11",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "我们只是来修一把剑。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "冷灰+暗红",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "城门侧光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "人群渐静",
            "soundEffects": "探测器空响、锁链落下",
            "music": "低频缓慢上升"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人站在检查台前，探测器举起"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人站在检查台前，探测器举起"
              },
              {
                "assetId": "C05",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人站在检查台前，探测器举起"
              }
            ],
            "props": [
              {
                "assetId": "P03",
                "state": "二人站在检查台前，探测器举起",
                "holderId": "C05"
              }
            ],
            "environment": "城门盘查",
            "lighting": "城门侧光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "空白读数与封锁"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "空白读数与封锁"
              },
              {
                "assetId": "C05",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "空白读数与封锁"
              }
            ],
            "props": [
              {
                "assetId": "P03",
                "state": "空白读数与封锁",
                "holderId": "C05"
              }
            ],
            "environment": "城门盘查",
            "lighting": "城门侧光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH010-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频",
                "imagePrompt": "空白读数与封锁，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH010-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "城门检查台固定正反打，探测器对准Karin和Rifa仍为零",
                "imagePrompt": "空白读数与封锁，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：城门检查台固定正反打，探测器对准Karin和Rifa仍为零。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH010-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "检查官说：“没有灵压，却带着Mahadel的徽记",
                "imagePrompt": "空白读数与封锁，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：检查官说：“没有灵压，却带着Mahadel的徽记。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH010-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "”Rifa平静回应：“你可以说我们很有礼貌",
                "imagePrompt": "空白读数与封锁，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”Rifa平静回应：“你可以说我们很有礼貌。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH010-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "”检查官抬手，竖幅上方闸门锁链落下：“也可以说，你们在隐藏危险",
                "imagePrompt": "空白读数与封锁，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”检查官抬手，竖幅上方闸门锁链落下：“也可以说，你们在隐藏危险。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH010-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "”Karin向前半步挡住检查官看向Rifa的视线：“我们只是来修一把剑",
                "imagePrompt": "空白读数与封锁，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”Karin向前半步挡住检查官看向Rifa的视线：“我们只是来修一把剑。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH010-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "”Karin在前景、Rifa在中景、双塔法师在高处远景，冷灰与暗红",
                "imagePrompt": "空白读数与封锁，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”Karin在前景、Rifa在中景、双塔法师在高处远景，冷灰与暗红。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH010-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "口型同步，无字幕、无现代检查站、无夸张表演、无魔法光球、无角色变形",
                "imagePrompt": "空白读数与封锁，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：口型同步，无字幕、无现代检查站、无夸张表演、无魔法光球、无角色变形。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH010-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "本内部镜头只执行：空白读数与封锁",
                "imagePrompt": "空白读数与封锁，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：空白读数与封锁。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH009"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Rifa 的身份特征、服装与道具不漂移",
                "assetId": "C02"
              },
              {
                "alias": "@图片4",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S02"
              }
            ]
          }
        },
        {
          "code": "SH011",
          "order": 11,
          "title": "空白读数 2/3",
          "description": "空白读数的连续反应与动作过渡",
          "sourceText": "马车穿过水波般的结界，高塔法师同时转头。检查官把黄铜探测器依次对准Karin与Rifa，指针死死停在零。\n检查官：“没有灵压，却带着Mahadel的徽记。”\nRifa：“你可以说我们很有礼貌。”\n检查官抬手，闸门锁链落下：“也可以说，你们在隐藏危险。”\nKarin向前半步，挡住检查官看向Rifa的视线。\nKarin：“我们只是来修一把剑。”",
          "shotBoundary": "锁链硬切",
          "dialogue": "检查官：也可以说，你们在隐藏危险。",
          "narration": "",
          "utterances": [
            {
              "id": "D10",
              "order": 1,
              "type": "dialogue",
              "speaker": "检查官",
              "text": "也可以说，你们在隐藏危险。"
            }
          ],
          "imagePrompt": "空白读数的连续反应与动作过渡，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频。城门检查台固定正反打，探测器对准Karin和Rifa仍为零。检查官说：“没有灵压，却带着Mahadel的徽记。”Rifa平静回应：“你可以说我们很有礼貌。”检查官抬手，竖幅上方闸门锁链落下：“也可以说，你们在隐藏危险。”Karin向前半步挡住检查官看向Rifa的视线：“我们只是来修一把剑。”Karin在前景、Rifa在中景、双塔法师在高处远景，冷灰与暗红。口型同步，无字幕、无现代检查站、无夸张表演、无魔法光球、无角色变形。\n本内部镜头只执行：空白读数的连续反应与动作过渡。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "固定正反打",
          "startFramePrompt": "空白读数与封锁，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "Karin前移半步，Rifa侧后，闸门锁闭\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无现代检查站、无夸张表演、无魔法光球、无角色变形。",
          "continuity": {
            "shotSize": "OTS/MCU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按空白读数与封锁的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "空白读数与封锁",
            "actionEnd": "Karin前移半步，Rifa侧后，闸门锁闭",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "锁链硬切"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02",
            "C05"
          ],
          "propCodes": [
            "P03"
          ],
          "clueCodes": [],
          "locationCode": "S02",
          "storySceneCode": "SC03",
          "timecode": "65-70s",
          "dramaticFunction": "承/盘查",
          "lens": "65mm",
          "lighting": "城门侧光",
          "colorPalette": "冷灰+暗红",
          "transitionOut": "锁链硬切",
          "performanceNotes": "没有灵压，却带着Mahadel的徽记。；你可以说我们很有礼貌。；也可以说，你们在隐藏危险。；我们只是来修一把剑。",
          "performancePlan": {
            "emotionalObjective": "围绕空白读数与封锁完成当前镜头的外在行动目标",
            "emotionalArc": "从进入空白读数与封锁的克制状态开始，经由动作反应推进，在Karin前移半步，Rifa侧后，闸门锁闭前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入空白读数与封锁"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "Karin前移半步，Rifa侧后，闸门锁闭"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D10",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "也可以说，你们在隐藏危险。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D08",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "没有灵压，却带着Mahadel的徽记。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D09",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "你可以说我们很有礼貌。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D11",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "我们只是来修一把剑。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "冷灰+暗红",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "城门侧光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "人群渐静",
            "soundEffects": "探测器空响、锁链落下",
            "music": "低频缓慢上升"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "空白读数与封锁"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "空白读数与封锁"
              },
              {
                "assetId": "C05",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "空白读数与封锁"
              }
            ],
            "props": [
              {
                "assetId": "P03",
                "state": "空白读数与封锁",
                "holderId": "C05"
              }
            ],
            "environment": "城门盘查",
            "lighting": "城门侧光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "空白读数的连续反应与动作过渡"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "空白读数的连续反应与动作过渡"
              },
              {
                "assetId": "C05",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "空白读数的连续反应与动作过渡"
              }
            ],
            "props": [
              {
                "assetId": "P03",
                "state": "空白读数的连续反应与动作过渡",
                "holderId": "C05"
              }
            ],
            "environment": "城门盘查",
            "lighting": "城门侧光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH011-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频",
                "imagePrompt": "空白读数的连续反应与动作过渡，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH011-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "城门检查台固定正反打，探测器对准Karin和Rifa仍为零",
                "imagePrompt": "空白读数的连续反应与动作过渡，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：城门检查台固定正反打，探测器对准Karin和Rifa仍为零。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH011-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "检查官说：“没有灵压，却带着Mahadel的徽记",
                "imagePrompt": "空白读数的连续反应与动作过渡，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：检查官说：“没有灵压，却带着Mahadel的徽记。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH011-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "”Rifa平静回应：“你可以说我们很有礼貌",
                "imagePrompt": "空白读数的连续反应与动作过渡，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”Rifa平静回应：“你可以说我们很有礼貌。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH011-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "”检查官抬手，竖幅上方闸门锁链落下：“也可以说，你们在隐藏危险",
                "imagePrompt": "空白读数的连续反应与动作过渡，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”检查官抬手，竖幅上方闸门锁链落下：“也可以说，你们在隐藏危险。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH011-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "”Karin向前半步挡住检查官看向Rifa的视线：“我们只是来修一把剑",
                "imagePrompt": "空白读数的连续反应与动作过渡，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”Karin向前半步挡住检查官看向Rifa的视线：“我们只是来修一把剑。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH011-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "”Karin在前景、Rifa在中景、双塔法师在高处远景，冷灰与暗红",
                "imagePrompt": "空白读数的连续反应与动作过渡，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”Karin在前景、Rifa在中景、双塔法师在高处远景，冷灰与暗红。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH011-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "口型同步，无字幕、无现代检查站、无夸张表演、无魔法光球、无角色变形",
                "imagePrompt": "空白读数的连续反应与动作过渡，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：口型同步，无字幕、无现代检查站、无夸张表演、无魔法光球、无角色变形。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH011-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "本内部镜头只执行：空白读数的连续反应与动作过渡",
                "imagePrompt": "空白读数的连续反应与动作过渡，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：空白读数的连续反应与动作过渡。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH010"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Rifa 的身份特征、服装与道具不漂移",
                "assetId": "C02"
              },
              {
                "alias": "@图片4",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S02"
              }
            ]
          }
        },
        {
          "code": "SH012",
          "order": 12,
          "title": "空白读数 3/3",
          "description": "Karin前移半步，Rifa侧后，闸门锁闭",
          "sourceText": "马车穿过水波般的结界，高塔法师同时转头。检查官把黄铜探测器依次对准Karin与Rifa，指针死死停在零。\n检查官：“没有灵压，却带着Mahadel的徽记。”\nRifa：“你可以说我们很有礼貌。”\n检查官抬手，闸门锁链落下：“也可以说，你们在隐藏危险。”\nKarin向前半步，挡住检查官看向Rifa的视线。\nKarin：“我们只是来修一把剑。”",
          "shotBoundary": "锁链硬切",
          "dialogue": "Karin：我们只是来修一把剑。",
          "narration": "",
          "utterances": [
            {
              "id": "D11",
              "order": 1,
              "type": "dialogue",
              "speaker": "Karin",
              "text": "我们只是来修一把剑。"
            }
          ],
          "imagePrompt": "Karin前移半步，Rifa侧后，闸门锁闭，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频。城门检查台固定正反打，探测器对准Karin和Rifa仍为零。检查官说：“没有灵压，却带着Mahadel的徽记。”Rifa平静回应：“你可以说我们很有礼貌。”检查官抬手，竖幅上方闸门锁链落下：“也可以说，你们在隐藏危险。”Karin向前半步挡住检查官看向Rifa的视线：“我们只是来修一把剑。”Karin在前景、Rifa在中景、双塔法师在高处远景，冷灰与暗红。口型同步，无字幕、无现代检查站、无夸张表演、无魔法光球、无角色变形。\n本内部镜头只执行：Karin前移半步，Rifa侧后，闸门锁闭。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "固定正反打",
          "startFramePrompt": "空白读数与封锁，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "Karin前移半步，Rifa侧后，闸门锁闭\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无现代检查站、无夸张表演、无魔法光球、无角色变形。",
          "continuity": {
            "shotSize": "OTS/MCU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按空白读数与封锁的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "空白读数与封锁",
            "actionEnd": "Karin前移半步，Rifa侧后，闸门锁闭",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "锁链硬切"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02",
            "C05"
          ],
          "propCodes": [
            "P03"
          ],
          "clueCodes": [],
          "locationCode": "S02",
          "storySceneCode": "SC03",
          "timecode": "70-75s",
          "dramaticFunction": "承/盘查",
          "lens": "65mm",
          "lighting": "城门侧光",
          "colorPalette": "冷灰+暗红",
          "transitionOut": "锁链硬切",
          "performanceNotes": "没有灵压，却带着Mahadel的徽记。；你可以说我们很有礼貌。；也可以说，你们在隐藏危险。；我们只是来修一把剑。",
          "performancePlan": {
            "emotionalObjective": "围绕空白读数与封锁完成当前镜头的外在行动目标",
            "emotionalArc": "从进入空白读数与封锁的克制状态开始，经由动作反应推进，在Karin前移半步，Rifa侧后，闸门锁闭前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入空白读数与封锁"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "Karin前移半步，Rifa侧后，闸门锁闭"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D11",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "我们只是来修一把剑。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D08",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "没有灵压，却带着Mahadel的徽记。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D09",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "你可以说我们很有礼貌。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D10",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "也可以说，你们在隐藏危险。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "冷灰+暗红",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "城门侧光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "人群渐静",
            "soundEffects": "探测器空响、锁链落下",
            "music": "低频缓慢上升"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "空白读数的连续反应与动作过渡"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "空白读数的连续反应与动作过渡"
              },
              {
                "assetId": "C05",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "空白读数的连续反应与动作过渡"
              }
            ],
            "props": [
              {
                "assetId": "P03",
                "state": "空白读数的连续反应与动作过渡",
                "holderId": "C05"
              }
            ],
            "environment": "城门盘查",
            "lighting": "城门侧光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Karin前移半步，Rifa侧后，闸门锁闭"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Karin前移半步，Rifa侧后，闸门锁闭"
              },
              {
                "assetId": "C05",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Karin前移半步，Rifa侧后，闸门锁闭"
              }
            ],
            "props": [
              {
                "assetId": "P03",
                "state": "Karin前移半步，Rifa侧后，闸门锁闭",
                "holderId": "C05"
              }
            ],
            "environment": "城门盘查",
            "lighting": "城门侧光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH012-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频",
                "imagePrompt": "Karin前移半步，Rifa侧后，闸门锁闭，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH012-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "城门检查台固定正反打，探测器对准Karin和Rifa仍为零",
                "imagePrompt": "Karin前移半步，Rifa侧后，闸门锁闭，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：城门检查台固定正反打，探测器对准Karin和Rifa仍为零。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH012-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "检查官说：“没有灵压，却带着Mahadel的徽记",
                "imagePrompt": "Karin前移半步，Rifa侧后，闸门锁闭，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：检查官说：“没有灵压，却带着Mahadel的徽记。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH012-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "”Rifa平静回应：“你可以说我们很有礼貌",
                "imagePrompt": "Karin前移半步，Rifa侧后，闸门锁闭，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”Rifa平静回应：“你可以说我们很有礼貌。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH012-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "”检查官抬手，竖幅上方闸门锁链落下：“也可以说，你们在隐藏危险",
                "imagePrompt": "Karin前移半步，Rifa侧后，闸门锁闭，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”检查官抬手，竖幅上方闸门锁链落下：“也可以说，你们在隐藏危险。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH012-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "”Karin向前半步挡住检查官看向Rifa的视线：“我们只是来修一把剑",
                "imagePrompt": "Karin前移半步，Rifa侧后，闸门锁闭，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”Karin向前半步挡住检查官看向Rifa的视线：“我们只是来修一把剑。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH012-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "”Karin在前景、Rifa在中景、双塔法师在高处远景，冷灰与暗红",
                "imagePrompt": "Karin前移半步，Rifa侧后，闸门锁闭，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”Karin在前景、Rifa在中景、双塔法师在高处远景，冷灰与暗红。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH012-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "口型同步，无字幕、无现代检查站、无夸张表演、无魔法光球、无角色变形",
                "imagePrompt": "Karin前移半步，Rifa侧后，闸门锁闭，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：口型同步，无字幕、无现代检查站、无夸张表演、无魔法光球、无角色变形。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH012-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "本内部镜头只执行：Karin前移半步，Rifa侧后，闸门锁闭",
                "imagePrompt": "Karin前移半步，Rifa侧后，闸门锁闭，OTS/MCU，城门侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：Karin前移半步，Rifa侧后，闸门锁闭。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH011"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Rifa 的身份特征、服装与道具不漂移",
                "assetId": "C02"
              },
              {
                "alias": "@图片4",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S02"
              }
            ]
          }
        },
        {
          "code": "SH013",
          "order": 13,
          "title": "旧信号 1/2",
          "description": "二人用旧信号决定解封",
          "sourceText": "Rifa不看Karin的脸，只看他扣在断剑上的拇指。那是两人早已约定的信号。她走到与他完全并肩的位置。\n两人同时松开封印的一线。\n没有火焰，没有雷霆。声音先被抽空。旗帜停在风里，尘埃悬浮，结界向二人凹陷，探测器从内部裂开。\nKarin先收力。Rifa慢半拍，确认他站稳才收回力量。\nKarin（低声）：“这样够明显吗？”\n检查官看见一年级徽记，放下手臂。闸门开启。高塔上，观察者转动四点银戒。\n观察者（耳语）：“两个异类。可预言里，缺了两个名字。”",
          "shotBoundary": "拇指动作切",
          "dialogue": "",
          "narration": "",
          "utterances": [],
          "imagePrompt": "二人用旧信号决定解封，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频。延续Karin挡在前方，Rifa不看他的脸，只看他扣在断剑剑柄上的拇指；Karin拇指缓慢压下，这是二人熟悉的信号。Rifa从中景向前一步，停到与他完全并肩的位置。二人交换极短视线，同时放松肩膀，准备松开封印。镜头从手部特写缓慢推至双人中景，城门双塔在上方压迫画面，暗蓝转暗紫，环境声逐渐收窄。无对白，无字幕、无浪漫化、无施法手势、无能量球、无角色换脸、无背景跳动。\n本内部镜头只执行：二人用旧信号决定解封。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "缓慢推近",
          "startFramePrompt": "二人用旧信号决定解封，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "两人完全并肩，封印将开未开\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无浪漫化、无施法手势、无能量球、无角色换脸、无背景跳动。",
          "continuity": {
            "shotSize": "CU→MS",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按二人用旧信号决定解封的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "二人用旧信号决定解封",
            "actionEnd": "两人完全并肩，封印将开未开",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "拇指动作切"
          },
          "duration": 7.5,
          "characterCodes": [
            "C01",
            "C02"
          ],
          "propCodes": [
            "P01"
          ],
          "clueCodes": [],
          "locationCode": "S02",
          "storySceneCode": "SC04",
          "timecode": "75-82.5s",
          "dramaticFunction": "转/选择",
          "lens": "85mm",
          "lighting": "冷暖分割",
          "colorPalette": "暗蓝→暗紫",
          "transitionOut": "拇指动作切",
          "performancePlan": {
            "emotionalObjective": "围绕二人用旧信号决定解封完成当前镜头的外在行动目标",
            "emotionalArc": "从进入二人用旧信号决定解封的克制状态开始，经由动作反应推进，在两人完全并肩，封印将开未开前收束",
            "speechStyle": "无对白，以呼吸、视线和动作反应传递情绪",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入二人用旧信号决定解封"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "两人完全并肩，封印将开未开"
              }
            }
          },
          "dialoguePerformance": [],
          "lightingPlan": {
            "palette": "暗蓝→暗紫",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "冷暖分割作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "城门底噪收窄",
            "soundEffects": "拇指压住剑柄、布料轻响",
            "music": "心跳式低频，不盖对白"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Karin前移半步，Rifa侧后，闸门锁闭"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Karin前移半步，Rifa侧后，闸门锁闭"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "进入二人用旧信号决定解封",
                "holderId": "C01"
              }
            ],
            "environment": "力量解封",
            "lighting": "冷暖分割",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人用旧信号决定解封"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人用旧信号决定解封"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "二人用旧信号决定解封",
                "holderId": "C01"
              }
            ],
            "environment": "力量解封",
            "lighting": "冷暖分割",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH013-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.833,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频",
                "imagePrompt": "二人用旧信号决定解封，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH013-F02",
                "sequenceIndex": 2,
                "startSecond": 0.833,
                "endSecond": 1.667,
                "actionPrompt": "延续Karin挡在前方，Rifa不看他的脸，只看他扣在断剑剑柄上的拇指",
                "imagePrompt": "二人用旧信号决定解封，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：延续Karin挡在前方，Rifa不看他的脸，只看他扣在断剑剑柄上的拇指。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH013-F03",
                "sequenceIndex": 3,
                "startSecond": 1.667,
                "endSecond": 2.5,
                "actionPrompt": "Karin拇指缓慢压下，这是二人熟悉的信号",
                "imagePrompt": "二人用旧信号决定解封，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin拇指缓慢压下，这是二人熟悉的信号。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH013-F04",
                "sequenceIndex": 4,
                "startSecond": 2.5,
                "endSecond": 3.333,
                "actionPrompt": "Rifa从中景向前一步，停到与他完全并肩的位置",
                "imagePrompt": "二人用旧信号决定解封，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa从中景向前一步，停到与他完全并肩的位置。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH013-F05",
                "sequenceIndex": 5,
                "startSecond": 3.333,
                "endSecond": 4.167,
                "actionPrompt": "二人交换极短视线，同时放松肩膀，准备松开封印",
                "imagePrompt": "二人用旧信号决定解封，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：二人交换极短视线，同时放松肩膀，准备松开封印。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH013-F06",
                "sequenceIndex": 6,
                "startSecond": 4.167,
                "endSecond": 5,
                "actionPrompt": "镜头从手部特写缓慢推至双人中景，城门双塔在上方压迫画面，暗蓝转暗紫，环境声逐渐收窄",
                "imagePrompt": "二人用旧信号决定解封，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：镜头从手部特写缓慢推至双人中景，城门双塔在上方压迫画面，暗蓝转暗紫，环境声逐渐收窄。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH013-F07",
                "sequenceIndex": 7,
                "startSecond": 5,
                "endSecond": 5.833,
                "actionPrompt": "无对白，无字幕、无浪漫化、无施法手势、无能量球、无角色换脸、无背景跳动",
                "imagePrompt": "二人用旧信号决定解封，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：无对白，无字幕、无浪漫化、无施法手势、无能量球、无角色换脸、无背景跳动。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH013-F08",
                "sequenceIndex": 8,
                "startSecond": 5.833,
                "endSecond": 6.667,
                "actionPrompt": "本内部镜头只执行：二人用旧信号决定解封",
                "imagePrompt": "二人用旧信号决定解封，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：二人用旧信号决定解封。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH013-F09",
                "sequenceIndex": 9,
                "startSecond": 6.667,
                "endSecond": 7.5,
                "actionPrompt": "保持角色、道具、轴线和前后状态连续",
                "imagePrompt": "二人用旧信号决定解封，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：保持角色、道具、轴线和前后状态连续。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH012"
              },
              {
                "alias": "@图片2",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S02"
              },
              {
                "alias": "@图片3",
                "role": "action_keyframe",
                "purpose": "动作关键帧：由本镜入口状态与动作起点派生，生成前需完成关键帧验收",
                "shotId": "SH013"
              }
            ]
          }
        },
        {
          "code": "SH014",
          "order": 14,
          "title": "旧信号 2/2",
          "description": "两人完全并肩，封印将开未开",
          "sourceText": "Rifa不看Karin的脸，只看他扣在断剑上的拇指。那是两人早已约定的信号。她走到与他完全并肩的位置。\n两人同时松开封印的一线。\n没有火焰，没有雷霆。声音先被抽空。旗帜停在风里，尘埃悬浮，结界向二人凹陷，探测器从内部裂开。\nKarin先收力。Rifa慢半拍，确认他站稳才收回力量。\nKarin（低声）：“这样够明显吗？”\n检查官看见一年级徽记，放下手臂。闸门开启。高塔上，观察者转动四点银戒。\n观察者（耳语）：“两个异类。可预言里，缺了两个名字。”",
          "shotBoundary": "拇指动作切",
          "dialogue": "",
          "narration": "",
          "utterances": [],
          "imagePrompt": "两人完全并肩，封印将开未开，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频。延续Karin挡在前方，Rifa不看他的脸，只看他扣在断剑剑柄上的拇指；Karin拇指缓慢压下，这是二人熟悉的信号。Rifa从中景向前一步，停到与他完全并肩的位置。二人交换极短视线，同时放松肩膀，准备松开封印。镜头从手部特写缓慢推至双人中景，城门双塔在上方压迫画面，暗蓝转暗紫，环境声逐渐收窄。无对白，无字幕、无浪漫化、无施法手势、无能量球、无角色换脸、无背景跳动。\n本内部镜头只执行：两人完全并肩，封印将开未开。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "缓慢推近",
          "startFramePrompt": "二人用旧信号决定解封，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "两人完全并肩，封印将开未开\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无浪漫化、无施法手势、无能量球、无角色换脸、无背景跳动。",
          "continuity": {
            "shotSize": "CU→MS",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按二人用旧信号决定解封的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "二人用旧信号决定解封",
            "actionEnd": "两人完全并肩，封印将开未开",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "拇指动作切"
          },
          "duration": 7.5,
          "characterCodes": [
            "C01",
            "C02"
          ],
          "propCodes": [
            "P01"
          ],
          "clueCodes": [],
          "locationCode": "S02",
          "storySceneCode": "SC04",
          "timecode": "82.5-90s",
          "dramaticFunction": "转/选择",
          "lens": "85mm",
          "lighting": "冷暖分割",
          "colorPalette": "暗蓝→暗紫",
          "transitionOut": "拇指动作切",
          "performancePlan": {
            "emotionalObjective": "围绕二人用旧信号决定解封完成当前镜头的外在行动目标",
            "emotionalArc": "从进入二人用旧信号决定解封的克制状态开始，经由动作反应推进，在两人完全并肩，封印将开未开前收束",
            "speechStyle": "无对白，以呼吸、视线和动作反应传递情绪",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入二人用旧信号决定解封"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "两人完全并肩，封印将开未开"
              }
            }
          },
          "dialoguePerformance": [],
          "lightingPlan": {
            "palette": "暗蓝→暗紫",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "冷暖分割作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "城门底噪收窄",
            "soundEffects": "拇指压住剑柄、布料轻响",
            "music": "心跳式低频，不盖对白"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人用旧信号决定解封"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人用旧信号决定解封"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "二人用旧信号决定解封",
                "holderId": "C01"
              }
            ],
            "environment": "力量解封",
            "lighting": "冷暖分割",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "两人完全并肩，封印将开未开"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "两人完全并肩，封印将开未开"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "两人完全并肩，封印将开未开",
                "holderId": "C01"
              }
            ],
            "environment": "力量解封",
            "lighting": "冷暖分割",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH014-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.833,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频",
                "imagePrompt": "两人完全并肩，封印将开未开，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH014-F02",
                "sequenceIndex": 2,
                "startSecond": 0.833,
                "endSecond": 1.667,
                "actionPrompt": "延续Karin挡在前方，Rifa不看他的脸，只看他扣在断剑剑柄上的拇指",
                "imagePrompt": "两人完全并肩，封印将开未开，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：延续Karin挡在前方，Rifa不看他的脸，只看他扣在断剑剑柄上的拇指。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH014-F03",
                "sequenceIndex": 3,
                "startSecond": 1.667,
                "endSecond": 2.5,
                "actionPrompt": "Karin拇指缓慢压下，这是二人熟悉的信号",
                "imagePrompt": "两人完全并肩，封印将开未开，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin拇指缓慢压下，这是二人熟悉的信号。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH014-F04",
                "sequenceIndex": 4,
                "startSecond": 2.5,
                "endSecond": 3.333,
                "actionPrompt": "Rifa从中景向前一步，停到与他完全并肩的位置",
                "imagePrompt": "两人完全并肩，封印将开未开，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa从中景向前一步，停到与他完全并肩的位置。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH014-F05",
                "sequenceIndex": 5,
                "startSecond": 3.333,
                "endSecond": 4.167,
                "actionPrompt": "二人交换极短视线，同时放松肩膀，准备松开封印",
                "imagePrompt": "两人完全并肩，封印将开未开，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：二人交换极短视线，同时放松肩膀，准备松开封印。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH014-F06",
                "sequenceIndex": 6,
                "startSecond": 4.167,
                "endSecond": 5,
                "actionPrompt": "镜头从手部特写缓慢推至双人中景，城门双塔在上方压迫画面，暗蓝转暗紫，环境声逐渐收窄",
                "imagePrompt": "两人完全并肩，封印将开未开，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：镜头从手部特写缓慢推至双人中景，城门双塔在上方压迫画面，暗蓝转暗紫，环境声逐渐收窄。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH014-F07",
                "sequenceIndex": 7,
                "startSecond": 5,
                "endSecond": 5.833,
                "actionPrompt": "无对白，无字幕、无浪漫化、无施法手势、无能量球、无角色换脸、无背景跳动",
                "imagePrompt": "两人完全并肩，封印将开未开，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：无对白，无字幕、无浪漫化、无施法手势、无能量球、无角色换脸、无背景跳动。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH014-F08",
                "sequenceIndex": 8,
                "startSecond": 5.833,
                "endSecond": 6.667,
                "actionPrompt": "本内部镜头只执行：两人完全并肩，封印将开未开",
                "imagePrompt": "两人完全并肩，封印将开未开，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：两人完全并肩，封印将开未开。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH014-F09",
                "sequenceIndex": 9,
                "startSecond": 6.667,
                "endSecond": 7.5,
                "actionPrompt": "保持角色、道具、轴线和前后状态连续",
                "imagePrompt": "两人完全并肩，封印将开未开，CU→MS，冷暖分割，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：保持角色、道具、轴线和前后状态连续。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH013"
              },
              {
                "alias": "@图片2",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S02"
              },
              {
                "alias": "@图片3",
                "role": "action_keyframe",
                "purpose": "动作关键帧：由本镜入口状态与动作起点派生，生成前需完成关键帧验收",
                "shotId": "SH014"
              }
            ]
          }
        },
        {
          "code": "SH015",
          "order": 15,
          "title": "力量与观察 1/3",
          "description": "世界短暂失去常态",
          "sourceText": "Rifa不看Karin的脸，只看他扣在断剑上的拇指。那是两人早已约定的信号。她走到与他完全并肩的位置。\n两人同时松开封印的一线。\n没有火焰，没有雷霆。声音先被抽空。旗帜停在风里，尘埃悬浮，结界向二人凹陷，探测器从内部裂开。\nKarin先收力。Rifa慢半拍，确认他站稳才收回力量。\nKarin（低声）：“这样够明显吗？”\n检查官看见一年级徽记，放下手臂。闸门开启。高塔上，观察者转动四点银戒。\n观察者（耳语）：“两个异类。可预言里，缺了两个名字。”",
          "shotBoundary": "声音骤停",
          "dialogue": "Karin：这样够明显吗？",
          "narration": "",
          "utterances": [
            {
              "id": "D12",
              "order": 1,
              "type": "dialogue",
              "speaker": "Karin",
              "text": "这样够明显吗？"
            }
          ],
          "imagePrompt": "世界短暂失去常态，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频，本集第一高潮。Karin与Rifa同时松开封印一线，没有火焰雷霆；声音消失三秒，旗帜停在高处，尘埃悬浮，皇家结界向二人凹陷，探测器从内部裂开。35mm极慢环绕一次，主体不移动。Karin先收力，Rifa确认他站稳才慢半拍收力。Karin低声：“这样够明显吗？”检查官看见一年级徽记，闸门开启。切到高塔观察者转动四点银戒，耳语：“两个异类。可预言里，缺了两个名字。”银白转冷紫黑。无字幕、无爆炸闪电火焰、无能量球、观察者不露脸、无角色变形。\n本内部镜头只执行：世界短暂失去常态。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "极慢环绕",
          "startFramePrompt": "世界短暂失去常态，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "二人收力站稳，闸门打开，观察者远望\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无爆炸闪电火焰、无能量球、观察者不露脸、无角色变形。",
          "continuity": {
            "shotSize": "WS→MCU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按世界短暂失去常态的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "世界短暂失去常态",
            "actionEnd": "二人收力站稳，闸门打开，观察者远望",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "声音骤停"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02",
            "C05",
            "C07"
          ],
          "propCodes": [
            "P03",
            "P06"
          ],
          "clueCodes": [],
          "locationCode": "S02",
          "storySceneCode": "SC04",
          "timecode": "90-95s",
          "dramaticFunction": "转/爆发",
          "lens": "35mm",
          "lighting": "银白无源光",
          "colorPalette": "银白+深紫",
          "transitionOut": "声音骤停",
          "performanceNotes": "这样够明显吗？；两个异类。可预言里，缺了两个名字。",
          "performancePlan": {
            "emotionalObjective": "围绕世界短暂失去常态完成当前镜头的外在行动目标",
            "emotionalArc": "从进入世界短暂失去常态的克制状态开始，经由动作反应推进，在二人收力站稳，闸门打开，观察者远望前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入世界短暂失去常态"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "二人收力站稳，闸门打开，观察者远望"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D12",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "这样够明显吗？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "银白+深紫",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "银白无源光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "前3秒完全静音",
            "soundEffects": "探测器细裂、闸门链条",
            "music": "一次低频冲击后骤停"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "两人完全并肩，封印将开未开"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "两人完全并肩，封印将开未开"
              },
              {
                "assetId": "C05",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "进入世界短暂失去常态"
              },
              {
                "assetId": "C07",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "进入世界短暂失去常态"
              }
            ],
            "props": [
              {
                "assetId": "P03",
                "state": "进入世界短暂失去常态",
                "holderId": "C05"
              },
              {
                "assetId": "P06",
                "state": "进入世界短暂失去常态",
                "holderId": "C07"
              }
            ],
            "environment": "力量解封",
            "lighting": "银白无源光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "世界短暂失去常态"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "世界短暂失去常态"
              },
              {
                "assetId": "C05",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "世界短暂失去常态"
              },
              {
                "assetId": "C07",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "世界短暂失去常态"
              }
            ],
            "props": [
              {
                "assetId": "P03",
                "state": "世界短暂失去常态",
                "holderId": "C05"
              },
              {
                "assetId": "P06",
                "state": "世界短暂失去常态",
                "holderId": "C07"
              }
            ],
            "environment": "力量解封",
            "lighting": "银白无源光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH015-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频，本集第一高潮",
                "imagePrompt": "世界短暂失去常态，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频，本集第一高潮。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH015-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "Karin与Rifa同时松开封印一线，没有火焰雷霆",
                "imagePrompt": "世界短暂失去常态，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin与Rifa同时松开封印一线，没有火焰雷霆。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH015-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "声音消失三秒，旗帜停在高处，尘埃悬浮，皇家结界向二人凹陷，探测器从内部裂开",
                "imagePrompt": "世界短暂失去常态，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：声音消失三秒，旗帜停在高处，尘埃悬浮，皇家结界向二人凹陷，探测器从内部裂开。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH015-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "35mm极慢环绕一次，主体不移动",
                "imagePrompt": "世界短暂失去常态，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：35mm极慢环绕一次，主体不移动。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH015-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "Karin先收力，Rifa确认他站稳才慢半拍收力",
                "imagePrompt": "世界短暂失去常态，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin先收力，Rifa确认他站稳才慢半拍收力。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH015-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "Karin低声：“这样够明显吗？”检查官看见一年级徽记，闸门开启",
                "imagePrompt": "世界短暂失去常态，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin低声：“这样够明显吗？”检查官看见一年级徽记，闸门开启。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH015-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "切到高塔观察者转动四点银戒，耳语：“两个异类",
                "imagePrompt": "世界短暂失去常态，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：切到高塔观察者转动四点银戒，耳语：“两个异类。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH015-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "可预言里，缺了两个名字",
                "imagePrompt": "世界短暂失去常态，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：可预言里，缺了两个名字。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH015-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "”银白转冷紫黑",
                "imagePrompt": "世界短暂失去常态，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”银白转冷紫黑。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH014"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S02"
              }
            ]
          }
        },
        {
          "code": "SH016",
          "order": 16,
          "title": "力量与观察 2/3",
          "description": "力量与观察的连续反应与动作过渡",
          "sourceText": "Rifa不看Karin的脸，只看他扣在断剑上的拇指。那是两人早已约定的信号。她走到与他完全并肩的位置。\n两人同时松开封印的一线。\n没有火焰，没有雷霆。声音先被抽空。旗帜停在风里，尘埃悬浮，结界向二人凹陷，探测器从内部裂开。\nKarin先收力。Rifa慢半拍，确认他站稳才收回力量。\nKarin（低声）：“这样够明显吗？”\n检查官看见一年级徽记，放下手臂。闸门开启。高塔上，观察者转动四点银戒。\n观察者（耳语）：“两个异类。可预言里，缺了两个名字。”",
          "shotBoundary": "声音骤停",
          "dialogue": "",
          "narration": "观察者：两个异类。可预言里，缺了两个名字。",
          "utterances": [
            {
              "id": "D13",
              "order": 1,
              "type": "voiceover",
              "speaker": "观察者",
              "text": "两个异类。可预言里，缺了两个名字。"
            }
          ],
          "imagePrompt": "力量与观察的连续反应与动作过渡，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频，本集第一高潮。Karin与Rifa同时松开封印一线，没有火焰雷霆；声音消失三秒，旗帜停在高处，尘埃悬浮，皇家结界向二人凹陷，探测器从内部裂开。35mm极慢环绕一次，主体不移动。Karin先收力，Rifa确认他站稳才慢半拍收力。Karin低声：“这样够明显吗？”检查官看见一年级徽记，闸门开启。切到高塔观察者转动四点银戒，耳语：“两个异类。可预言里，缺了两个名字。”银白转冷紫黑。无字幕、无爆炸闪电火焰、无能量球、观察者不露脸、无角色变形。\n本内部镜头只执行：力量与观察的连续反应与动作过渡。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "极慢环绕",
          "startFramePrompt": "世界短暂失去常态，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "二人收力站稳，闸门打开，观察者远望\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无爆炸闪电火焰、无能量球、观察者不露脸、无角色变形。",
          "continuity": {
            "shotSize": "WS→MCU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按世界短暂失去常态的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "世界短暂失去常态",
            "actionEnd": "二人收力站稳，闸门打开，观察者远望",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "声音骤停"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02",
            "C05",
            "C07"
          ],
          "propCodes": [
            "P03",
            "P06"
          ],
          "clueCodes": [],
          "locationCode": "S02",
          "storySceneCode": "SC04",
          "timecode": "95-100s",
          "dramaticFunction": "转/爆发",
          "lens": "35mm",
          "lighting": "银白无源光",
          "colorPalette": "银白+深紫",
          "transitionOut": "声音骤停",
          "performanceNotes": "这样够明显吗？；两个异类。可预言里，缺了两个名字。",
          "performancePlan": {
            "emotionalObjective": "围绕世界短暂失去常态完成当前镜头的外在行动目标",
            "emotionalArc": "从进入世界短暂失去常态的克制状态开始，经由动作反应推进，在二人收力站稳，闸门打开，观察者远望前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入世界短暂失去常态"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "二人收力站稳，闸门打开，观察者远望"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D12",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "这样够明显吗？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "银白+深紫",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "银白无源光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "前3秒完全静音",
            "soundEffects": "探测器细裂、闸门链条",
            "music": "一次低频冲击后骤停"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "世界短暂失去常态"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "世界短暂失去常态"
              },
              {
                "assetId": "C05",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "世界短暂失去常态"
              },
              {
                "assetId": "C07",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "世界短暂失去常态"
              }
            ],
            "props": [
              {
                "assetId": "P03",
                "state": "世界短暂失去常态",
                "holderId": "C05"
              },
              {
                "assetId": "P06",
                "state": "世界短暂失去常态",
                "holderId": "C07"
              }
            ],
            "environment": "力量解封",
            "lighting": "银白无源光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "力量与观察的连续反应与动作过渡"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "力量与观察的连续反应与动作过渡"
              },
              {
                "assetId": "C05",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "力量与观察的连续反应与动作过渡"
              },
              {
                "assetId": "C07",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "力量与观察的连续反应与动作过渡"
              }
            ],
            "props": [
              {
                "assetId": "P03",
                "state": "力量与观察的连续反应与动作过渡",
                "holderId": "C05"
              },
              {
                "assetId": "P06",
                "state": "力量与观察的连续反应与动作过渡",
                "holderId": "C07"
              }
            ],
            "environment": "力量解封",
            "lighting": "银白无源光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH016-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频，本集第一高潮",
                "imagePrompt": "力量与观察的连续反应与动作过渡，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频，本集第一高潮。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH016-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "Karin与Rifa同时松开封印一线，没有火焰雷霆",
                "imagePrompt": "力量与观察的连续反应与动作过渡，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin与Rifa同时松开封印一线，没有火焰雷霆。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH016-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "声音消失三秒，旗帜停在高处，尘埃悬浮，皇家结界向二人凹陷，探测器从内部裂开",
                "imagePrompt": "力量与观察的连续反应与动作过渡，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：声音消失三秒，旗帜停在高处，尘埃悬浮，皇家结界向二人凹陷，探测器从内部裂开。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH016-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "35mm极慢环绕一次，主体不移动",
                "imagePrompt": "力量与观察的连续反应与动作过渡，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：35mm极慢环绕一次，主体不移动。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH016-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "Karin先收力，Rifa确认他站稳才慢半拍收力",
                "imagePrompt": "力量与观察的连续反应与动作过渡，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin先收力，Rifa确认他站稳才慢半拍收力。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH016-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "Karin低声：“这样够明显吗？”检查官看见一年级徽记，闸门开启",
                "imagePrompt": "力量与观察的连续反应与动作过渡，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin低声：“这样够明显吗？”检查官看见一年级徽记，闸门开启。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH016-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "切到高塔观察者转动四点银戒，耳语：“两个异类",
                "imagePrompt": "力量与观察的连续反应与动作过渡，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：切到高塔观察者转动四点银戒，耳语：“两个异类。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH016-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "可预言里，缺了两个名字",
                "imagePrompt": "力量与观察的连续反应与动作过渡，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：可预言里，缺了两个名字。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH016-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "”银白转冷紫黑",
                "imagePrompt": "力量与观察的连续反应与动作过渡，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”银白转冷紫黑。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH015"
              },
              {
                "alias": "@图片2",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S02"
              },
              {
                "alias": "@图片3",
                "role": "action_keyframe",
                "purpose": "动作关键帧：由本镜入口状态与动作起点派生，生成前需完成关键帧验收",
                "shotId": "SH016"
              }
            ]
          }
        },
        {
          "code": "SH017",
          "order": 17,
          "title": "力量与观察 3/3",
          "description": "二人收力站稳，闸门打开，观察者远望",
          "sourceText": "Rifa不看Karin的脸，只看他扣在断剑上的拇指。那是两人早已约定的信号。她走到与他完全并肩的位置。\n两人同时松开封印的一线。\n没有火焰，没有雷霆。声音先被抽空。旗帜停在风里，尘埃悬浮，结界向二人凹陷，探测器从内部裂开。\nKarin先收力。Rifa慢半拍，确认他站稳才收回力量。\nKarin（低声）：“这样够明显吗？”\n检查官看见一年级徽记，放下手臂。闸门开启。高塔上，观察者转动四点银戒。\n观察者（耳语）：“两个异类。可预言里，缺了两个名字。”",
          "shotBoundary": "声音骤停",
          "dialogue": "",
          "narration": "",
          "utterances": [],
          "imagePrompt": "二人收力站稳，闸门打开，观察者远望，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实奇幻视频，本集第一高潮。Karin与Rifa同时松开封印一线，没有火焰雷霆；声音消失三秒，旗帜停在高处，尘埃悬浮，皇家结界向二人凹陷，探测器从内部裂开。35mm极慢环绕一次，主体不移动。Karin先收力，Rifa确认他站稳才慢半拍收力。Karin低声：“这样够明显吗？”检查官看见一年级徽记，闸门开启。切到高塔观察者转动四点银戒，耳语：“两个异类。可预言里，缺了两个名字。”银白转冷紫黑。无字幕、无爆炸闪电火焰、无能量球、观察者不露脸、无角色变形。\n本内部镜头只执行：二人收力站稳，闸门打开，观察者远望。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "极慢环绕",
          "startFramePrompt": "世界短暂失去常态，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "二人收力站稳，闸门打开，观察者远望\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无爆炸闪电火焰、无能量球、观察者不露脸、无角色变形。",
          "continuity": {
            "shotSize": "WS→MCU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按世界短暂失去常态的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "世界短暂失去常态",
            "actionEnd": "二人收力站稳，闸门打开，观察者远望",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "声音骤停"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02",
            "C05",
            "C07"
          ],
          "propCodes": [
            "P03",
            "P06"
          ],
          "clueCodes": [],
          "locationCode": "S02",
          "storySceneCode": "SC04",
          "timecode": "100-105s",
          "dramaticFunction": "转/爆发",
          "lens": "35mm",
          "lighting": "银白无源光",
          "colorPalette": "银白+深紫",
          "transitionOut": "声音骤停",
          "performanceNotes": "这样够明显吗？；两个异类。可预言里，缺了两个名字。",
          "performancePlan": {
            "emotionalObjective": "围绕世界短暂失去常态完成当前镜头的外在行动目标",
            "emotionalArc": "从进入世界短暂失去常态的克制状态开始，经由动作反应推进，在二人收力站稳，闸门打开，观察者远望前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入世界短暂失去常态"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "二人收力站稳，闸门打开，观察者远望"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D12",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "这样够明显吗？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "银白+深紫",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "银白无源光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "前3秒完全静音",
            "soundEffects": "探测器细裂、闸门链条",
            "music": "一次低频冲击后骤停"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "力量与观察的连续反应与动作过渡"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "力量与观察的连续反应与动作过渡"
              },
              {
                "assetId": "C05",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "力量与观察的连续反应与动作过渡"
              },
              {
                "assetId": "C07",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "力量与观察的连续反应与动作过渡"
              }
            ],
            "props": [
              {
                "assetId": "P03",
                "state": "力量与观察的连续反应与动作过渡",
                "holderId": "C05"
              },
              {
                "assetId": "P06",
                "state": "力量与观察的连续反应与动作过渡",
                "holderId": "C07"
              }
            ],
            "environment": "力量解封",
            "lighting": "银白无源光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人收力站稳，闸门打开，观察者远望"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人收力站稳，闸门打开，观察者远望"
              },
              {
                "assetId": "C05",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人收力站稳，闸门打开，观察者远望"
              },
              {
                "assetId": "C07",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人收力站稳，闸门打开，观察者远望"
              }
            ],
            "props": [
              {
                "assetId": "P03",
                "state": "二人收力站稳，闸门打开，观察者远望",
                "holderId": "C05"
              },
              {
                "assetId": "P06",
                "state": "二人收力站稳，闸门打开，观察者远望",
                "holderId": "C07"
              }
            ],
            "environment": "力量解封",
            "lighting": "银白无源光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH017-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实奇幻视频，本集第一高潮",
                "imagePrompt": "二人收力站稳，闸门打开，观察者远望，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实奇幻视频，本集第一高潮。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH017-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "Karin与Rifa同时松开封印一线，没有火焰雷霆",
                "imagePrompt": "二人收力站稳，闸门打开，观察者远望，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin与Rifa同时松开封印一线，没有火焰雷霆。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH017-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "声音消失三秒，旗帜停在高处，尘埃悬浮，皇家结界向二人凹陷，探测器从内部裂开",
                "imagePrompt": "二人收力站稳，闸门打开，观察者远望，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：声音消失三秒，旗帜停在高处，尘埃悬浮，皇家结界向二人凹陷，探测器从内部裂开。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH017-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "35mm极慢环绕一次，主体不移动",
                "imagePrompt": "二人收力站稳，闸门打开，观察者远望，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：35mm极慢环绕一次，主体不移动。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH017-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "Karin先收力，Rifa确认他站稳才慢半拍收力",
                "imagePrompt": "二人收力站稳，闸门打开，观察者远望，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin先收力，Rifa确认他站稳才慢半拍收力。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH017-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "Karin低声：“这样够明显吗？”检查官看见一年级徽记，闸门开启",
                "imagePrompt": "二人收力站稳，闸门打开，观察者远望，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin低声：“这样够明显吗？”检查官看见一年级徽记，闸门开启。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH017-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "切到高塔观察者转动四点银戒，耳语：“两个异类",
                "imagePrompt": "二人收力站稳，闸门打开，观察者远望，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：切到高塔观察者转动四点银戒，耳语：“两个异类。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH017-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "可预言里，缺了两个名字",
                "imagePrompt": "二人收力站稳，闸门打开，观察者远望，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：可预言里，缺了两个名字。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH017-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "”银白转冷紫黑",
                "imagePrompt": "二人收力站稳，闸门打开，观察者远望，WS→MCU，银白无源光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”银白转冷紫黑。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH016"
              },
              {
                "alias": "@图片2",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S02"
              },
              {
                "alias": "@图片3",
                "role": "action_keyframe",
                "purpose": "动作关键帧：由本镜入口状态与动作起点派生，生成前需完成关键帧验收",
                "shotId": "SH017"
              }
            ]
          }
        },
        {
          "code": "SH018",
          "order": 18,
          "title": "我问的是你 1/3",
          "description": "城市揭示与关系停顿",
          "sourceText": "城市沿竖向陡坡层层升高。Karin仰头看得出神，断剑撞上手推车，他立刻护住剑鞘。\nRifa：“还疼？”\nKarin：“剑不会疼。”\nRifa放慢脚步，与他并肩：“我问的是你。”\nKarin不回答，但没有把手从剑上移开。",
          "shotBoundary": "碰剑声切",
          "dialogue": "Rifa：还疼？",
          "narration": "",
          "utterances": [
            {
              "id": "D14",
              "order": 1,
              "type": "dialogue",
              "speaker": "Rifa",
              "text": "还疼？"
            }
          ],
          "imagePrompt": "城市揭示与关系停顿，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实情感奇幻视频。镜头沿阿佐雷斯陡坡竖向下降，展示层叠塔楼、吊桥与水渠，再落到Karin和Rifa。Karin仰头时断剑撞上蓝玻璃瓶手推车，他立刻护住剑鞘。Rifa问：“还疼？”Karin避开视线：“剑不会疼。”Rifa放慢脚步与他并肩：“我问的是你。”沉默两秒，Karin没有把手从剑上移开。24mm转50mm但只做一次下降后固定，石灰白、琥珀与灰蓝。拟亲情关系，不做浪漫凝视或拥抱，无字幕、无现代城市、无角色换脸、无横向拥挤。\n本内部镜头只执行：城市揭示与关系停顿。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "吊臂下降",
          "startFramePrompt": "城市揭示与关系停顿，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "二人并肩抵达上行坡道\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无现代城市、无角色换脸、无横向拥挤。",
          "continuity": {
            "shotSize": "ELS→MS",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按城市揭示与关系停顿的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "城市揭示与关系停顿",
            "actionEnd": "二人并肩抵达上行坡道",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "碰剑声切"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02"
          ],
          "propCodes": [
            "P01"
          ],
          "clueCodes": [],
          "locationCode": "S03",
          "storySceneCode": "SC05",
          "timecode": "105-110s",
          "dramaticFunction": "转/余波",
          "lens": "24mm",
          "lighting": "散射光+炉火",
          "colorPalette": "石灰白+琥珀+灰蓝",
          "transitionOut": "碰剑声切",
          "performanceNotes": "还疼？；剑不会疼。；我问的是你。",
          "performancePlan": {
            "emotionalObjective": "围绕城市揭示与关系停顿完成当前镜头的外在行动目标",
            "emotionalArc": "从进入城市揭示与关系停顿的克制状态开始，经由动作反应推进，在二人并肩抵达上行坡道前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入城市揭示与关系停顿"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "二人并肩抵达上行坡道"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D14",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "还疼？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D15",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "剑不会疼。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D16",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "我问的是你。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "石灰白+琥珀+灰蓝",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "散射光+炉火作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "城市人声、铁锤、水渠",
            "soundEffects": "剑鞘碰车沿",
            "music": "木管好奇动机转暖弦"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人收力站稳，闸门打开，观察者远望"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人收力站稳，闸门打开，观察者远望"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "进入城市揭示与关系停顿",
                "holderId": "C01"
              }
            ],
            "environment": "阿佐雷斯街巷",
            "lighting": "散射光+炉火",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "城市揭示与关系停顿"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "城市揭示与关系停顿"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "城市揭示与关系停顿",
                "holderId": "C01"
              }
            ],
            "environment": "阿佐雷斯街巷",
            "lighting": "散射光+炉火",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH018-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实情感奇幻视频",
                "imagePrompt": "城市揭示与关系停顿，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实情感奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH018-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "镜头沿阿佐雷斯陡坡竖向下降，展示层叠塔楼、吊桥与水渠，再落到Karin和Rifa",
                "imagePrompt": "城市揭示与关系停顿，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：镜头沿阿佐雷斯陡坡竖向下降，展示层叠塔楼、吊桥与水渠，再落到Karin和Rifa。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH018-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "Karin仰头时断剑撞上蓝玻璃瓶手推车，他立刻护住剑鞘",
                "imagePrompt": "城市揭示与关系停顿，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin仰头时断剑撞上蓝玻璃瓶手推车，他立刻护住剑鞘。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH018-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "Rifa问：“还疼？”Karin避开视线：“剑不会疼",
                "imagePrompt": "城市揭示与关系停顿，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa问：“还疼？”Karin避开视线：“剑不会疼。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH018-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "”Rifa放慢脚步与他并肩：“我问的是你",
                "imagePrompt": "城市揭示与关系停顿，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”Rifa放慢脚步与他并肩：“我问的是你。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH018-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "”沉默两秒，Karin没有把手从剑上移开",
                "imagePrompt": "城市揭示与关系停顿，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”沉默两秒，Karin没有把手从剑上移开。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH018-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "24mm转50mm但只做一次下降后固定，石灰白、琥珀与灰蓝",
                "imagePrompt": "城市揭示与关系停顿，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：24mm转50mm但只做一次下降后固定，石灰白、琥珀与灰蓝。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH018-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "拟亲情关系，不做浪漫凝视或拥抱，无字幕、无现代城市、无角色换脸、无横向拥挤",
                "imagePrompt": "城市揭示与关系停顿，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：拟亲情关系，不做浪漫凝视或拥抱，无字幕、无现代城市、无角色换脸、无横向拥挤。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH018-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "本内部镜头只执行：城市揭示与关系停顿",
                "imagePrompt": "城市揭示与关系停顿，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：城市揭示与关系停顿。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH017"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Rifa 的身份特征、服装与道具不漂移",
                "assetId": "C02"
              },
              {
                "alias": "@图片3",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S03"
              }
            ]
          }
        },
        {
          "code": "SH019",
          "order": 19,
          "title": "我问的是你 2/3",
          "description": "我问的是你的连续反应与动作过渡",
          "sourceText": "城市沿竖向陡坡层层升高。Karin仰头看得出神，断剑撞上手推车，他立刻护住剑鞘。\nRifa：“还疼？”\nKarin：“剑不会疼。”\nRifa放慢脚步，与他并肩：“我问的是你。”\nKarin不回答，但没有把手从剑上移开。",
          "shotBoundary": "碰剑声切",
          "dialogue": "Karin：剑不会疼。",
          "narration": "",
          "utterances": [
            {
              "id": "D15",
              "order": 1,
              "type": "dialogue",
              "speaker": "Karin",
              "text": "剑不会疼。"
            }
          ],
          "imagePrompt": "我问的是你的连续反应与动作过渡，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实情感奇幻视频。镜头沿阿佐雷斯陡坡竖向下降，展示层叠塔楼、吊桥与水渠，再落到Karin和Rifa。Karin仰头时断剑撞上蓝玻璃瓶手推车，他立刻护住剑鞘。Rifa问：“还疼？”Karin避开视线：“剑不会疼。”Rifa放慢脚步与他并肩：“我问的是你。”沉默两秒，Karin没有把手从剑上移开。24mm转50mm但只做一次下降后固定，石灰白、琥珀与灰蓝。拟亲情关系，不做浪漫凝视或拥抱，无字幕、无现代城市、无角色换脸、无横向拥挤。\n本内部镜头只执行：我问的是你的连续反应与动作过渡。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "吊臂下降",
          "startFramePrompt": "城市揭示与关系停顿，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "二人并肩抵达上行坡道\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无现代城市、无角色换脸、无横向拥挤。",
          "continuity": {
            "shotSize": "ELS→MS",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按城市揭示与关系停顿的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "城市揭示与关系停顿",
            "actionEnd": "二人并肩抵达上行坡道",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "碰剑声切"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02"
          ],
          "propCodes": [
            "P01"
          ],
          "clueCodes": [],
          "locationCode": "S03",
          "storySceneCode": "SC05",
          "timecode": "110-115s",
          "dramaticFunction": "转/余波",
          "lens": "24mm",
          "lighting": "散射光+炉火",
          "colorPalette": "石灰白+琥珀+灰蓝",
          "transitionOut": "碰剑声切",
          "performanceNotes": "还疼？；剑不会疼。；我问的是你。",
          "performancePlan": {
            "emotionalObjective": "围绕城市揭示与关系停顿完成当前镜头的外在行动目标",
            "emotionalArc": "从进入城市揭示与关系停顿的克制状态开始，经由动作反应推进，在二人并肩抵达上行坡道前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入城市揭示与关系停顿"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "二人并肩抵达上行坡道"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D15",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "剑不会疼。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D14",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "还疼？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D16",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "我问的是你。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "石灰白+琥珀+灰蓝",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "散射光+炉火作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "城市人声、铁锤、水渠",
            "soundEffects": "剑鞘碰车沿",
            "music": "木管好奇动机转暖弦"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "城市揭示与关系停顿"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "城市揭示与关系停顿"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "城市揭示与关系停顿",
                "holderId": "C01"
              }
            ],
            "environment": "阿佐雷斯街巷",
            "lighting": "散射光+炉火",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "我问的是你的连续反应与动作过渡"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "我问的是你的连续反应与动作过渡"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "我问的是你的连续反应与动作过渡",
                "holderId": "C01"
              }
            ],
            "environment": "阿佐雷斯街巷",
            "lighting": "散射光+炉火",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH019-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实情感奇幻视频",
                "imagePrompt": "我问的是你的连续反应与动作过渡，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实情感奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH019-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "镜头沿阿佐雷斯陡坡竖向下降，展示层叠塔楼、吊桥与水渠，再落到Karin和Rifa",
                "imagePrompt": "我问的是你的连续反应与动作过渡，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：镜头沿阿佐雷斯陡坡竖向下降，展示层叠塔楼、吊桥与水渠，再落到Karin和Rifa。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH019-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "Karin仰头时断剑撞上蓝玻璃瓶手推车，他立刻护住剑鞘",
                "imagePrompt": "我问的是你的连续反应与动作过渡，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin仰头时断剑撞上蓝玻璃瓶手推车，他立刻护住剑鞘。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH019-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "Rifa问：“还疼？”Karin避开视线：“剑不会疼",
                "imagePrompt": "我问的是你的连续反应与动作过渡，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa问：“还疼？”Karin避开视线：“剑不会疼。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH019-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "”Rifa放慢脚步与他并肩：“我问的是你",
                "imagePrompt": "我问的是你的连续反应与动作过渡，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”Rifa放慢脚步与他并肩：“我问的是你。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH019-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "”沉默两秒，Karin没有把手从剑上移开",
                "imagePrompt": "我问的是你的连续反应与动作过渡，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”沉默两秒，Karin没有把手从剑上移开。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH019-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "24mm转50mm但只做一次下降后固定，石灰白、琥珀与灰蓝",
                "imagePrompt": "我问的是你的连续反应与动作过渡，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：24mm转50mm但只做一次下降后固定，石灰白、琥珀与灰蓝。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH019-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "拟亲情关系，不做浪漫凝视或拥抱，无字幕、无现代城市、无角色换脸、无横向拥挤",
                "imagePrompt": "我问的是你的连续反应与动作过渡，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：拟亲情关系，不做浪漫凝视或拥抱，无字幕、无现代城市、无角色换脸、无横向拥挤。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH019-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "本内部镜头只执行：我问的是你的连续反应与动作过渡",
                "imagePrompt": "我问的是你的连续反应与动作过渡，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：我问的是你的连续反应与动作过渡。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH018"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S03"
              }
            ]
          }
        },
        {
          "code": "SH020",
          "order": 20,
          "title": "我问的是你 3/3",
          "description": "二人并肩抵达上行坡道",
          "sourceText": "城市沿竖向陡坡层层升高。Karin仰头看得出神，断剑撞上手推车，他立刻护住剑鞘。\nRifa：“还疼？”\nKarin：“剑不会疼。”\nRifa放慢脚步，与他并肩：“我问的是你。”\nKarin不回答，但没有把手从剑上移开。",
          "shotBoundary": "碰剑声切",
          "dialogue": "Rifa：我问的是你。",
          "narration": "",
          "utterances": [
            {
              "id": "D16",
              "order": 1,
              "type": "dialogue",
              "speaker": "Rifa",
              "text": "我问的是你。"
            }
          ],
          "imagePrompt": "二人并肩抵达上行坡道，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实情感奇幻视频。镜头沿阿佐雷斯陡坡竖向下降，展示层叠塔楼、吊桥与水渠，再落到Karin和Rifa。Karin仰头时断剑撞上蓝玻璃瓶手推车，他立刻护住剑鞘。Rifa问：“还疼？”Karin避开视线：“剑不会疼。”Rifa放慢脚步与他并肩：“我问的是你。”沉默两秒，Karin没有把手从剑上移开。24mm转50mm但只做一次下降后固定，石灰白、琥珀与灰蓝。拟亲情关系，不做浪漫凝视或拥抱，无字幕、无现代城市、无角色换脸、无横向拥挤。\n本内部镜头只执行：二人并肩抵达上行坡道。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "吊臂下降",
          "startFramePrompt": "城市揭示与关系停顿，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "二人并肩抵达上行坡道\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无现代城市、无角色换脸、无横向拥挤。",
          "continuity": {
            "shotSize": "ELS→MS",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按城市揭示与关系停顿的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "城市揭示与关系停顿",
            "actionEnd": "二人并肩抵达上行坡道",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "碰剑声切"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02"
          ],
          "propCodes": [
            "P01"
          ],
          "clueCodes": [],
          "locationCode": "S03",
          "storySceneCode": "SC05",
          "timecode": "115-120s",
          "dramaticFunction": "转/余波",
          "lens": "24mm",
          "lighting": "散射光+炉火",
          "colorPalette": "石灰白+琥珀+灰蓝",
          "transitionOut": "碰剑声切",
          "performanceNotes": "还疼？；剑不会疼。；我问的是你。",
          "performancePlan": {
            "emotionalObjective": "围绕城市揭示与关系停顿完成当前镜头的外在行动目标",
            "emotionalArc": "从进入城市揭示与关系停顿的克制状态开始，经由动作反应推进，在二人并肩抵达上行坡道前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入城市揭示与关系停顿"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "二人并肩抵达上行坡道"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D16",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "我问的是你。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D14",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "还疼？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D15",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "剑不会疼。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "石灰白+琥珀+灰蓝",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "散射光+炉火作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "城市人声、铁锤、水渠",
            "soundEffects": "剑鞘碰车沿",
            "music": "木管好奇动机转暖弦"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "我问的是你的连续反应与动作过渡"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "我问的是你的连续反应与动作过渡"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "我问的是你的连续反应与动作过渡",
                "holderId": "C01"
              }
            ],
            "environment": "阿佐雷斯街巷",
            "lighting": "散射光+炉火",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人并肩抵达上行坡道"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人并肩抵达上行坡道"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "二人并肩抵达上行坡道",
                "holderId": "C01"
              }
            ],
            "environment": "阿佐雷斯街巷",
            "lighting": "散射光+炉火",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH020-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实情感奇幻视频",
                "imagePrompt": "二人并肩抵达上行坡道，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实情感奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH020-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "镜头沿阿佐雷斯陡坡竖向下降，展示层叠塔楼、吊桥与水渠，再落到Karin和Rifa",
                "imagePrompt": "二人并肩抵达上行坡道，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：镜头沿阿佐雷斯陡坡竖向下降，展示层叠塔楼、吊桥与水渠，再落到Karin和Rifa。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH020-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "Karin仰头时断剑撞上蓝玻璃瓶手推车，他立刻护住剑鞘",
                "imagePrompt": "二人并肩抵达上行坡道，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin仰头时断剑撞上蓝玻璃瓶手推车，他立刻护住剑鞘。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH020-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "Rifa问：“还疼？”Karin避开视线：“剑不会疼",
                "imagePrompt": "二人并肩抵达上行坡道，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa问：“还疼？”Karin避开视线：“剑不会疼。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH020-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "”Rifa放慢脚步与他并肩：“我问的是你",
                "imagePrompt": "二人并肩抵达上行坡道，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”Rifa放慢脚步与他并肩：“我问的是你。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH020-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "”沉默两秒，Karin没有把手从剑上移开",
                "imagePrompt": "二人并肩抵达上行坡道，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”沉默两秒，Karin没有把手从剑上移开。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH020-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "24mm转50mm但只做一次下降后固定，石灰白、琥珀与灰蓝",
                "imagePrompt": "二人并肩抵达上行坡道，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：24mm转50mm但只做一次下降后固定，石灰白、琥珀与灰蓝。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH020-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "拟亲情关系，不做浪漫凝视或拥抱，无字幕、无现代城市、无角色换脸、无横向拥挤",
                "imagePrompt": "二人并肩抵达上行坡道，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：拟亲情关系，不做浪漫凝视或拥抱，无字幕、无现代城市、无角色换脸、无横向拥挤。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH020-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "本内部镜头只执行：二人并肩抵达上行坡道",
                "imagePrompt": "二人并肩抵达上行坡道，ELS→MS，散射光+炉火，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：二人并肩抵达上行坡道。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH019"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Rifa 的身份特征、服装与道具不漂移",
                "assetId": "C02"
              },
              {
                "alias": "@图片3",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S03"
              }
            ]
          }
        },
        {
          "code": "SH021",
          "order": 21,
          "title": "银色裂痕 1/2",
          "description": "裂纹似梦中断口",
          "sourceText": "坡道尽头，木牌上的银色裂痕与梦中剑刃的裂口完全相同。\nRifa：“你见过这个？”\nKarin：“没有。”\n他说得太快。抬起的手尚未碰门，断剑先在鞘中震动。门内传来三次锤击，木门自行开启。\n奥伦在纵深尽头背对二人：“关门。把剑放到铁砧上。”",
          "shotBoundary": "门开切内景",
          "dialogue": "Rifa：你见过这个？\nKarin：没有。",
          "narration": "",
          "utterances": [
            {
              "id": "D17",
              "order": 1,
              "type": "dialogue",
              "speaker": "Rifa",
              "text": "你见过这个？"
            },
            {
              "id": "D18",
              "order": 2,
              "type": "dialogue",
              "speaker": "Karin",
              "text": "没有。"
            }
          ],
          "imagePrompt": "裂纹似梦中断口，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频。陡坡尽头的Edia Knight木门占满竖幅，门牌只有抽象银色裂痕，不显示可读文字；裂痕与Karin黑湖梦中剑刃裂口相同。Rifa看Karin而非门牌：“你见过这个？”Karin回答过快：“没有。”他抬手未触门，腰后断剑先震动；门内三次锤击，木门开启，冷蓝外光与暗琥珀炉光交汇，奥伦在纵深尽头背对二人：“关门。把剑放到铁砧上。”从裂纹特写后拉，口型同步，无字幕、无现代门锁、无可读招牌、无电动机械感、无角色变形。\n本内部镜头只执行：裂纹似梦中断口。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "银裂纹后拉",
          "startFramePrompt": "裂纹似梦中断口，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "二人立在门槛，奥伦背对，Karin隐瞒梦境\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无现代门锁、无可读招牌、无电动机械感、无角色变形。",
          "continuity": {
            "shotSize": "CU→LS",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按裂纹似梦中断口的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "裂纹似梦中断口",
            "actionEnd": "二人立在门槛，奥伦背对，Karin隐瞒梦境",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "门开切内景"
          },
          "duration": 7.5,
          "characterCodes": [
            "C01",
            "C02",
            "C06"
          ],
          "propCodes": [
            "P01"
          ],
          "clueCodes": [],
          "locationCode": "S04",
          "storySceneCode": "SC06",
          "timecode": "120-127.5s",
          "dramaticFunction": "合/召唤",
          "lens": "65mm",
          "lighting": "银纹冷光+炉光",
          "colorPalette": "冷银+暗琥珀",
          "transitionOut": "门开切内景",
          "performanceNotes": "你见过这个？；没有。；关门。把剑放到铁砧上。",
          "performancePlan": {
            "emotionalObjective": "围绕裂纹似梦中断口完成当前镜头的外在行动目标",
            "emotionalArc": "从进入裂纹似梦中断口的克制状态开始，经由动作反应推进，在二人立在门槛，奥伦背对，Karin隐瞒梦境前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入裂纹似梦中断口"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "二人立在门槛，奥伦背对，Karin隐瞒梦境"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D17",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "你见过这个？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D18",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "没有。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D19",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "关门。把剑放到铁砧上。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "冷银+暗琥珀",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "银纹冷光+炉光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "坡道风声",
            "soundEffects": "断剑震动、三次锤击、门滑开",
            "music": "两音母题反向出现"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人并肩抵达上行坡道"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人并肩抵达上行坡道"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "进入裂纹似梦中断口"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "二人并肩抵达上行坡道",
                "holderId": "C01"
              }
            ],
            "environment": "Edia Knight门前",
            "lighting": "银纹冷光+炉光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "裂纹似梦中断口"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "裂纹似梦中断口"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "裂纹似梦中断口"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "裂纹似梦中断口",
                "holderId": "C01"
              }
            ],
            "environment": "Edia Knight门前",
            "lighting": "银纹冷光+炉光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH021-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.833,
                "actionPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频",
                "imagePrompt": "裂纹似梦中断口，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实悬疑奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH021-F02",
                "sequenceIndex": 2,
                "startSecond": 0.833,
                "endSecond": 1.667,
                "actionPrompt": "陡坡尽头的Edia Knight木门占满竖幅，门牌只有抽象银色裂痕，不显示可读文字",
                "imagePrompt": "裂纹似梦中断口，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：陡坡尽头的Edia Knight木门占满竖幅，门牌只有抽象银色裂痕，不显示可读文字。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH021-F03",
                "sequenceIndex": 3,
                "startSecond": 1.667,
                "endSecond": 2.5,
                "actionPrompt": "裂痕与Karin黑湖梦中剑刃裂口相同",
                "imagePrompt": "裂纹似梦中断口，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：裂痕与Karin黑湖梦中剑刃裂口相同。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH021-F04",
                "sequenceIndex": 4,
                "startSecond": 2.5,
                "endSecond": 3.333,
                "actionPrompt": "Rifa看Karin而非门牌：“你见过这个？”Karin回答过快：“没有",
                "imagePrompt": "裂纹似梦中断口，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa看Karin而非门牌：“你见过这个？”Karin回答过快：“没有。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH021-F05",
                "sequenceIndex": 5,
                "startSecond": 3.333,
                "endSecond": 4.167,
                "actionPrompt": "”他抬手未触门，腰后断剑先震动",
                "imagePrompt": "裂纹似梦中断口，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”他抬手未触门，腰后断剑先震动。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH021-F06",
                "sequenceIndex": 6,
                "startSecond": 4.167,
                "endSecond": 5,
                "actionPrompt": "门内三次锤击，木门开启，冷蓝外光与暗琥珀炉光交汇，奥伦在纵深尽头背对二人：“关门",
                "imagePrompt": "裂纹似梦中断口，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：门内三次锤击，木门开启，冷蓝外光与暗琥珀炉光交汇，奥伦在纵深尽头背对二人：“关门。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH021-F07",
                "sequenceIndex": 7,
                "startSecond": 5,
                "endSecond": 5.833,
                "actionPrompt": "把剑放到铁砧上",
                "imagePrompt": "裂纹似梦中断口，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：把剑放到铁砧上。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH021-F08",
                "sequenceIndex": 8,
                "startSecond": 5.833,
                "endSecond": 6.667,
                "actionPrompt": "”从裂纹特写后拉，口型同步，无字幕、无现代门锁、无可读招牌、无电动机械感、无角色变形",
                "imagePrompt": "裂纹似梦中断口，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”从裂纹特写后拉，口型同步，无字幕、无现代门锁、无可读招牌、无电动机械感、无角色变形。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH021-F09",
                "sequenceIndex": 9,
                "startSecond": 6.667,
                "endSecond": 7.5,
                "actionPrompt": "本内部镜头只执行：裂纹似梦中断口",
                "imagePrompt": "裂纹似梦中断口，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：裂纹似梦中断口。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH020"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Rifa 的身份特征、服装与道具不漂移",
                "assetId": "C02"
              },
              {
                "alias": "@图片4",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S04"
              }
            ]
          }
        },
        {
          "code": "SH022",
          "order": 22,
          "title": "银色裂痕 2/2",
          "description": "二人立在门槛，奥伦背对，Karin隐瞒梦境",
          "sourceText": "坡道尽头，木牌上的银色裂痕与梦中剑刃的裂口完全相同。\nRifa：“你见过这个？”\nKarin：“没有。”\n他说得太快。抬起的手尚未碰门，断剑先在鞘中震动。门内传来三次锤击，木门自行开启。\n奥伦在纵深尽头背对二人：“关门。把剑放到铁砧上。”",
          "shotBoundary": "门开切内景",
          "dialogue": "奥伦：关门。把剑放到铁砧上。",
          "narration": "",
          "utterances": [
            {
              "id": "D19",
              "order": 1,
              "type": "dialogue",
              "speaker": "奥伦",
              "text": "关门。把剑放到铁砧上。"
            }
          ],
          "imagePrompt": "二人立在门槛，奥伦背对，Karin隐瞒梦境，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频。陡坡尽头的Edia Knight木门占满竖幅，门牌只有抽象银色裂痕，不显示可读文字；裂痕与Karin黑湖梦中剑刃裂口相同。Rifa看Karin而非门牌：“你见过这个？”Karin回答过快：“没有。”他抬手未触门，腰后断剑先震动；门内三次锤击，木门开启，冷蓝外光与暗琥珀炉光交汇，奥伦在纵深尽头背对二人：“关门。把剑放到铁砧上。”从裂纹特写后拉，口型同步，无字幕、无现代门锁、无可读招牌、无电动机械感、无角色变形。\n本内部镜头只执行：二人立在门槛，奥伦背对，Karin隐瞒梦境。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "银裂纹后拉",
          "startFramePrompt": "裂纹似梦中断口，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "二人立在门槛，奥伦背对，Karin隐瞒梦境\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无现代门锁、无可读招牌、无电动机械感、无角色变形。",
          "continuity": {
            "shotSize": "CU→LS",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按裂纹似梦中断口的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "裂纹似梦中断口",
            "actionEnd": "二人立在门槛，奥伦背对，Karin隐瞒梦境",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "门开切内景"
          },
          "duration": 7.5,
          "characterCodes": [
            "C01",
            "C02",
            "C06"
          ],
          "propCodes": [
            "P01"
          ],
          "clueCodes": [],
          "locationCode": "S04",
          "storySceneCode": "SC06",
          "timecode": "127.5-135s",
          "dramaticFunction": "合/召唤",
          "lens": "65mm",
          "lighting": "银纹冷光+炉光",
          "colorPalette": "冷银+暗琥珀",
          "transitionOut": "门开切内景",
          "performanceNotes": "你见过这个？；没有。；关门。把剑放到铁砧上。",
          "performancePlan": {
            "emotionalObjective": "围绕裂纹似梦中断口完成当前镜头的外在行动目标",
            "emotionalArc": "从进入裂纹似梦中断口的克制状态开始，经由动作反应推进，在二人立在门槛，奥伦背对，Karin隐瞒梦境前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入裂纹似梦中断口"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "二人立在门槛，奥伦背对，Karin隐瞒梦境"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D19",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "关门。把剑放到铁砧上。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D17",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "你见过这个？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D18",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "没有。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "冷银+暗琥珀",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "银纹冷光+炉光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "坡道风声",
            "soundEffects": "断剑震动、三次锤击、门滑开",
            "music": "两音母题反向出现"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "裂纹似梦中断口"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "裂纹似梦中断口"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "裂纹似梦中断口"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "裂纹似梦中断口",
                "holderId": "C01"
              }
            ],
            "environment": "Edia Knight门前",
            "lighting": "银纹冷光+炉光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人立在门槛，奥伦背对，Karin隐瞒梦境"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人立在门槛，奥伦背对，Karin隐瞒梦境"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人立在门槛，奥伦背对，Karin隐瞒梦境"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "二人立在门槛，奥伦背对，Karin隐瞒梦境",
                "holderId": "C01"
              }
            ],
            "environment": "Edia Knight门前",
            "lighting": "银纹冷光+炉光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH022-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.833,
                "actionPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频",
                "imagePrompt": "二人立在门槛，奥伦背对，Karin隐瞒梦境，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实悬疑奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH022-F02",
                "sequenceIndex": 2,
                "startSecond": 0.833,
                "endSecond": 1.667,
                "actionPrompt": "陡坡尽头的Edia Knight木门占满竖幅，门牌只有抽象银色裂痕，不显示可读文字",
                "imagePrompt": "二人立在门槛，奥伦背对，Karin隐瞒梦境，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：陡坡尽头的Edia Knight木门占满竖幅，门牌只有抽象银色裂痕，不显示可读文字。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH022-F03",
                "sequenceIndex": 3,
                "startSecond": 1.667,
                "endSecond": 2.5,
                "actionPrompt": "裂痕与Karin黑湖梦中剑刃裂口相同",
                "imagePrompt": "二人立在门槛，奥伦背对，Karin隐瞒梦境，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：裂痕与Karin黑湖梦中剑刃裂口相同。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH022-F04",
                "sequenceIndex": 4,
                "startSecond": 2.5,
                "endSecond": 3.333,
                "actionPrompt": "Rifa看Karin而非门牌：“你见过这个？”Karin回答过快：“没有",
                "imagePrompt": "二人立在门槛，奥伦背对，Karin隐瞒梦境，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa看Karin而非门牌：“你见过这个？”Karin回答过快：“没有。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH022-F05",
                "sequenceIndex": 5,
                "startSecond": 3.333,
                "endSecond": 4.167,
                "actionPrompt": "”他抬手未触门，腰后断剑先震动",
                "imagePrompt": "二人立在门槛，奥伦背对，Karin隐瞒梦境，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”他抬手未触门，腰后断剑先震动。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH022-F06",
                "sequenceIndex": 6,
                "startSecond": 4.167,
                "endSecond": 5,
                "actionPrompt": "门内三次锤击，木门开启，冷蓝外光与暗琥珀炉光交汇，奥伦在纵深尽头背对二人：“关门",
                "imagePrompt": "二人立在门槛，奥伦背对，Karin隐瞒梦境，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：门内三次锤击，木门开启，冷蓝外光与暗琥珀炉光交汇，奥伦在纵深尽头背对二人：“关门。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH022-F07",
                "sequenceIndex": 7,
                "startSecond": 5,
                "endSecond": 5.833,
                "actionPrompt": "把剑放到铁砧上",
                "imagePrompt": "二人立在门槛，奥伦背对，Karin隐瞒梦境，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：把剑放到铁砧上。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH022-F08",
                "sequenceIndex": 8,
                "startSecond": 5.833,
                "endSecond": 6.667,
                "actionPrompt": "”从裂纹特写后拉，口型同步，无字幕、无现代门锁、无可读招牌、无电动机械感、无角色变形",
                "imagePrompt": "二人立在门槛，奥伦背对，Karin隐瞒梦境，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”从裂纹特写后拉，口型同步，无字幕、无现代门锁、无可读招牌、无电动机械感、无角色变形。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH022-F09",
                "sequenceIndex": 9,
                "startSecond": 6.667,
                "endSecond": 7.5,
                "actionPrompt": "本内部镜头只执行：二人立在门槛，奥伦背对，Karin隐瞒梦境",
                "imagePrompt": "二人立在门槛，奥伦背对，Karin隐瞒梦境，CU→LS，银纹冷光+炉光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：二人立在门槛，奥伦背对，Karin隐瞒梦境。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH021"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S04"
              }
            ]
          }
        },
        {
          "code": "SH023",
          "order": 23,
          "title": "你看见的是结果 1/3",
          "description": "奥伦质疑“被打断”",
          "sourceText": "Rifa守在门与Karin之间，直到Karin主动走向铁砧才让开半步。\n奥伦不看推荐信：“谁告诉你，它是被打断的？”\nKarin：“我看着它断的。”\n奥伦：“你看见的是结果。”\n无头锤柄碰触断口。炉火缩成一线，店内金属全部朝铁砧偏转。\n黑湖、倒塔、四只手。这一次，Karin看清其中一只手腕系着暗红细线。他转头看向Rifa的辫绳。Rifa立刻抓住他的手腕，幻象破碎。\n奥伦：“别放开。剑正在借她的记忆认你。”\nRifa：“你知道它为什么断？”\n奥伦取出带四点印记的木匣：“它不是断了。它在拒绝保持完整。”\n他把木匣推向Karin：“而你，不是第一个带它来这里的人。”\n铜镜中没有店内三人，只有高塔上的斗篷身影。Rifa的短刃滑出半寸。\nRifa：“上一个人是谁？”\n奥伦熄灭炉火。黑暗中，木匣再次耳语：“你又来迟了。”\n切黑。",
          "shotBoundary": "锤柄触剑切",
          "dialogue": "奥伦：谁告诉你，它是被打断的？",
          "narration": "",
          "utterances": [
            {
              "id": "D20",
              "order": 1,
              "type": "dialogue",
              "speaker": "奥伦",
              "text": "谁告诉你，它是被打断的？"
            }
          ],
          "imagePrompt": "奥伦质疑“被打断”，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频。Edia Knight内，门框在后上方、铁砧居中、炉膛后下方形成竖向纵深。Rifa守在门与Karin之间，Karin主动走向铁砧后她才让半步。奥伦，灰白后梳长发、左眼皮革眼罩、深棕围裙、左臂黑护具，不看推荐信，问：“谁告诉你，它是被打断的？”Karin把断剑放上铁砧：“我看着它断的。”奥伦：“你看见的是结果。”停一秒，无头锤柄抵住断口。50mm侧向短滑轨，煤黑与暗琥珀，口型同步，无字幕、无现代工具、无角色变形、无过量火花。\n本内部镜头只执行：奥伦质疑“被打断”。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "侧向滑轨",
          "startFramePrompt": "奥伦质疑“被打断”，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "断剑平放铁砧，锤柄抵住断口\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无现代工具、无角色变形、无过量火花。",
          "continuity": {
            "shotSize": "MCU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按奥伦质疑“被打断”的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "奥伦质疑“被打断”",
            "actionEnd": "断剑平放铁砧，锤柄抵住断口",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "锤柄触剑切"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02",
            "C06"
          ],
          "propCodes": [
            "P01",
            "P07"
          ],
          "clueCodes": [],
          "locationCode": "S04",
          "storySceneCode": "SC07",
          "timecode": "135-140s",
          "dramaticFunction": "合/试探",
          "lens": "50mm",
          "lighting": "炉火侧光",
          "colorPalette": "煤黑+琥珀",
          "transitionOut": "锤柄触剑切",
          "performanceNotes": "谁告诉你，它是被打断的？；我看着它断的。；你看见的是结果。",
          "performancePlan": {
            "emotionalObjective": "围绕奥伦质疑“被打断”完成当前镜头的外在行动目标",
            "emotionalArc": "从进入奥伦质疑“被打断”的克制状态开始，经由动作反应推进，在断剑平放铁砧，锤柄抵住断口前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入奥伦质疑“被打断”"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "断剑平放铁砧，锤柄抵住断口"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D20",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "谁告诉你，它是被打断的？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D21",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "我看着它断的。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D22",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "你看见的是结果。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "煤黑+琥珀",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "炉火侧光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "炉火、极远街声",
            "soundEffects": "断剑放上铁砧、木柄轻触",
            "music": "单一低弦持续，不抢台词"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人立在门槛，奥伦背对，Karin隐瞒梦境"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人立在门槛，奥伦背对，Karin隐瞒梦境"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "二人立在门槛，奥伦背对，Karin隐瞒梦境"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "二人立在门槛，奥伦背对，Karin隐瞒梦境",
                "holderId": "C01"
              },
              {
                "assetId": "P07",
                "state": "进入奥伦质疑“被打断”",
                "holderId": "C06"
              }
            ],
            "environment": "铸剑师的警告",
            "lighting": "炉火侧光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "奥伦质疑“被打断”"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "奥伦质疑“被打断”"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "奥伦质疑“被打断”"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "奥伦质疑“被打断”",
                "holderId": "C01"
              },
              {
                "assetId": "P07",
                "state": "奥伦质疑“被打断”",
                "holderId": "C06"
              }
            ],
            "environment": "铸剑师的警告",
            "lighting": "炉火侧光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH023-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频",
                "imagePrompt": "奥伦质疑“被打断”，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实悬疑奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH023-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "Edia Knight内，门框在后上方、铁砧居中、炉膛后下方形成竖向纵深",
                "imagePrompt": "奥伦质疑“被打断”，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Edia Knight内，门框在后上方、铁砧居中、炉膛后下方形成竖向纵深。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH023-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "Rifa守在门与Karin之间，Karin主动走向铁砧后她才让半步",
                "imagePrompt": "奥伦质疑“被打断”，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa守在门与Karin之间，Karin主动走向铁砧后她才让半步。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH023-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "奥伦，灰白后梳长发、左眼皮革眼罩、深棕围裙、左臂黑护具，不看推荐信，问：“谁告诉你，它是被打断的？”Karin把断剑放上铁砧：“我看着它断的",
                "imagePrompt": "奥伦质疑“被打断”，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：奥伦，灰白后梳长发、左眼皮革眼罩、深棕围裙、左臂黑护具，不看推荐信，问：“谁告诉你，它是被打断的？”Karin把断剑放上铁砧：“我看着它断的。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH023-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "”奥伦：“你看见的是结果",
                "imagePrompt": "奥伦质疑“被打断”，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”奥伦：“你看见的是结果。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH023-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "”停一秒，无头锤柄抵住断口",
                "imagePrompt": "奥伦质疑“被打断”，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”停一秒，无头锤柄抵住断口。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH023-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "50mm侧向短滑轨，煤黑与暗琥珀，口型同步，无字幕、无现代工具、无角色变形、无过量火花",
                "imagePrompt": "奥伦质疑“被打断”，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：50mm侧向短滑轨，煤黑与暗琥珀，口型同步，无字幕、无现代工具、无角色变形、无过量火花。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH023-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "本内部镜头只执行：奥伦质疑“被打断”",
                "imagePrompt": "奥伦质疑“被打断”，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：奥伦质疑“被打断”。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH023-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "保持角色、道具、轴线和前后状态连续",
                "imagePrompt": "奥伦质疑“被打断”，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：保持角色、道具、轴线和前后状态连续。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH022"
              },
              {
                "alias": "@图片2",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S04"
              },
              {
                "alias": "@图片3",
                "role": "action_keyframe",
                "purpose": "动作关键帧：由本镜入口状态与动作起点派生，生成前需完成关键帧验收",
                "shotId": "SH023"
              }
            ]
          }
        },
        {
          "code": "SH024",
          "order": 24,
          "title": "你看见的是结果 2/3",
          "description": "你看见的是结果的连续反应与动作过渡",
          "sourceText": "Rifa守在门与Karin之间，直到Karin主动走向铁砧才让开半步。\n奥伦不看推荐信：“谁告诉你，它是被打断的？”\nKarin：“我看着它断的。”\n奥伦：“你看见的是结果。”\n无头锤柄碰触断口。炉火缩成一线，店内金属全部朝铁砧偏转。\n黑湖、倒塔、四只手。这一次，Karin看清其中一只手腕系着暗红细线。他转头看向Rifa的辫绳。Rifa立刻抓住他的手腕，幻象破碎。\n奥伦：“别放开。剑正在借她的记忆认你。”\nRifa：“你知道它为什么断？”\n奥伦取出带四点印记的木匣：“它不是断了。它在拒绝保持完整。”\n他把木匣推向Karin：“而你，不是第一个带它来这里的人。”\n铜镜中没有店内三人，只有高塔上的斗篷身影。Rifa的短刃滑出半寸。\nRifa：“上一个人是谁？”\n奥伦熄灭炉火。黑暗中，木匣再次耳语：“你又来迟了。”\n切黑。",
          "shotBoundary": "锤柄触剑切",
          "dialogue": "Karin：我看着它断的。",
          "narration": "",
          "utterances": [
            {
              "id": "D21",
              "order": 1,
              "type": "dialogue",
              "speaker": "Karin",
              "text": "我看着它断的。"
            }
          ],
          "imagePrompt": "你看见的是结果的连续反应与动作过渡，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频。Edia Knight内，门框在后上方、铁砧居中、炉膛后下方形成竖向纵深。Rifa守在门与Karin之间，Karin主动走向铁砧后她才让半步。奥伦，灰白后梳长发、左眼皮革眼罩、深棕围裙、左臂黑护具，不看推荐信，问：“谁告诉你，它是被打断的？”Karin把断剑放上铁砧：“我看着它断的。”奥伦：“你看见的是结果。”停一秒，无头锤柄抵住断口。50mm侧向短滑轨，煤黑与暗琥珀，口型同步，无字幕、无现代工具、无角色变形、无过量火花。\n本内部镜头只执行：你看见的是结果的连续反应与动作过渡。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "侧向滑轨",
          "startFramePrompt": "奥伦质疑“被打断”，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "断剑平放铁砧，锤柄抵住断口\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无现代工具、无角色变形、无过量火花。",
          "continuity": {
            "shotSize": "MCU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按奥伦质疑“被打断”的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "奥伦质疑“被打断”",
            "actionEnd": "断剑平放铁砧，锤柄抵住断口",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "锤柄触剑切"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02",
            "C06"
          ],
          "propCodes": [
            "P01",
            "P07"
          ],
          "clueCodes": [],
          "locationCode": "S04",
          "storySceneCode": "SC07",
          "timecode": "140-145s",
          "dramaticFunction": "合/试探",
          "lens": "50mm",
          "lighting": "炉火侧光",
          "colorPalette": "煤黑+琥珀",
          "transitionOut": "锤柄触剑切",
          "performanceNotes": "谁告诉你，它是被打断的？；我看着它断的。；你看见的是结果。",
          "performancePlan": {
            "emotionalObjective": "围绕奥伦质疑“被打断”完成当前镜头的外在行动目标",
            "emotionalArc": "从进入奥伦质疑“被打断”的克制状态开始，经由动作反应推进，在断剑平放铁砧，锤柄抵住断口前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入奥伦质疑“被打断”"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "断剑平放铁砧，锤柄抵住断口"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D21",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "我看着它断的。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D20",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "谁告诉你，它是被打断的？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D22",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "你看见的是结果。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "煤黑+琥珀",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "炉火侧光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "炉火、极远街声",
            "soundEffects": "断剑放上铁砧、木柄轻触",
            "music": "单一低弦持续，不抢台词"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "奥伦质疑“被打断”"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "奥伦质疑“被打断”"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "奥伦质疑“被打断”"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "奥伦质疑“被打断”",
                "holderId": "C01"
              },
              {
                "assetId": "P07",
                "state": "奥伦质疑“被打断”",
                "holderId": "C06"
              }
            ],
            "environment": "铸剑师的警告",
            "lighting": "炉火侧光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "你看见的是结果的连续反应与动作过渡"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "你看见的是结果的连续反应与动作过渡"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "你看见的是结果的连续反应与动作过渡"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "你看见的是结果的连续反应与动作过渡",
                "holderId": "C01"
              },
              {
                "assetId": "P07",
                "state": "你看见的是结果的连续反应与动作过渡",
                "holderId": "C06"
              }
            ],
            "environment": "铸剑师的警告",
            "lighting": "炉火侧光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH024-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频",
                "imagePrompt": "你看见的是结果的连续反应与动作过渡，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实悬疑奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH024-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "Edia Knight内，门框在后上方、铁砧居中、炉膛后下方形成竖向纵深",
                "imagePrompt": "你看见的是结果的连续反应与动作过渡，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Edia Knight内，门框在后上方、铁砧居中、炉膛后下方形成竖向纵深。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH024-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "Rifa守在门与Karin之间，Karin主动走向铁砧后她才让半步",
                "imagePrompt": "你看见的是结果的连续反应与动作过渡，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa守在门与Karin之间，Karin主动走向铁砧后她才让半步。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH024-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "奥伦，灰白后梳长发、左眼皮革眼罩、深棕围裙、左臂黑护具，不看推荐信，问：“谁告诉你，它是被打断的？”Karin把断剑放上铁砧：“我看着它断的",
                "imagePrompt": "你看见的是结果的连续反应与动作过渡，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：奥伦，灰白后梳长发、左眼皮革眼罩、深棕围裙、左臂黑护具，不看推荐信，问：“谁告诉你，它是被打断的？”Karin把断剑放上铁砧：“我看着它断的。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH024-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "”奥伦：“你看见的是结果",
                "imagePrompt": "你看见的是结果的连续反应与动作过渡，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”奥伦：“你看见的是结果。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH024-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "”停一秒，无头锤柄抵住断口",
                "imagePrompt": "你看见的是结果的连续反应与动作过渡，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”停一秒，无头锤柄抵住断口。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH024-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "50mm侧向短滑轨，煤黑与暗琥珀，口型同步，无字幕、无现代工具、无角色变形、无过量火花",
                "imagePrompt": "你看见的是结果的连续反应与动作过渡，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：50mm侧向短滑轨，煤黑与暗琥珀，口型同步，无字幕、无现代工具、无角色变形、无过量火花。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH024-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "本内部镜头只执行：你看见的是结果的连续反应与动作过渡",
                "imagePrompt": "你看见的是结果的连续反应与动作过渡，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：你看见的是结果的连续反应与动作过渡。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH024-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "保持角色、道具、轴线和前后状态连续",
                "imagePrompt": "你看见的是结果的连续反应与动作过渡，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：保持角色、道具、轴线和前后状态连续。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH023"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S04"
              }
            ]
          }
        },
        {
          "code": "SH025",
          "order": 25,
          "title": "你看见的是结果 3/3",
          "description": "断剑平放铁砧，锤柄抵住断口",
          "sourceText": "Rifa守在门与Karin之间，直到Karin主动走向铁砧才让开半步。\n奥伦不看推荐信：“谁告诉你，它是被打断的？”\nKarin：“我看着它断的。”\n奥伦：“你看见的是结果。”\n无头锤柄碰触断口。炉火缩成一线，店内金属全部朝铁砧偏转。\n黑湖、倒塔、四只手。这一次，Karin看清其中一只手腕系着暗红细线。他转头看向Rifa的辫绳。Rifa立刻抓住他的手腕，幻象破碎。\n奥伦：“别放开。剑正在借她的记忆认你。”\nRifa：“你知道它为什么断？”\n奥伦取出带四点印记的木匣：“它不是断了。它在拒绝保持完整。”\n他把木匣推向Karin：“而你，不是第一个带它来这里的人。”\n铜镜中没有店内三人，只有高塔上的斗篷身影。Rifa的短刃滑出半寸。\nRifa：“上一个人是谁？”\n奥伦熄灭炉火。黑暗中，木匣再次耳语：“你又来迟了。”\n切黑。",
          "shotBoundary": "锤柄触剑切",
          "dialogue": "奥伦：你看见的是结果。",
          "narration": "",
          "utterances": [
            {
              "id": "D22",
              "order": 1,
              "type": "dialogue",
              "speaker": "奥伦",
              "text": "你看见的是结果。"
            }
          ],
          "imagePrompt": "断剑平放铁砧，锤柄抵住断口，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频。Edia Knight内，门框在后上方、铁砧居中、炉膛后下方形成竖向纵深。Rifa守在门与Karin之间，Karin主动走向铁砧后她才让半步。奥伦，灰白后梳长发、左眼皮革眼罩、深棕围裙、左臂黑护具，不看推荐信，问：“谁告诉你，它是被打断的？”Karin把断剑放上铁砧：“我看着它断的。”奥伦：“你看见的是结果。”停一秒，无头锤柄抵住断口。50mm侧向短滑轨，煤黑与暗琥珀，口型同步，无字幕、无现代工具、无角色变形、无过量火花。\n本内部镜头只执行：断剑平放铁砧，锤柄抵住断口。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "侧向滑轨",
          "startFramePrompt": "奥伦质疑“被打断”，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "断剑平放铁砧，锤柄抵住断口\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无现代工具、无角色变形、无过量火花。",
          "continuity": {
            "shotSize": "MCU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按奥伦质疑“被打断”的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "奥伦质疑“被打断”",
            "actionEnd": "断剑平放铁砧，锤柄抵住断口",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "锤柄触剑切"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02",
            "C06"
          ],
          "propCodes": [
            "P01",
            "P07"
          ],
          "clueCodes": [],
          "locationCode": "S04",
          "storySceneCode": "SC07",
          "timecode": "145-150s",
          "dramaticFunction": "合/试探",
          "lens": "50mm",
          "lighting": "炉火侧光",
          "colorPalette": "煤黑+琥珀",
          "transitionOut": "锤柄触剑切",
          "performanceNotes": "谁告诉你，它是被打断的？；我看着它断的。；你看见的是结果。",
          "performancePlan": {
            "emotionalObjective": "围绕奥伦质疑“被打断”完成当前镜头的外在行动目标",
            "emotionalArc": "从进入奥伦质疑“被打断”的克制状态开始，经由动作反应推进，在断剑平放铁砧，锤柄抵住断口前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入奥伦质疑“被打断”"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "断剑平放铁砧，锤柄抵住断口"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D22",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "你看见的是结果。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D20",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "谁告诉你，它是被打断的？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D21",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "我看着它断的。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "煤黑+琥珀",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "炉火侧光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "炉火、极远街声",
            "soundEffects": "断剑放上铁砧、木柄轻触",
            "music": "单一低弦持续，不抢台词"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "你看见的是结果的连续反应与动作过渡"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "你看见的是结果的连续反应与动作过渡"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "你看见的是结果的连续反应与动作过渡"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "你看见的是结果的连续反应与动作过渡",
                "holderId": "C01"
              },
              {
                "assetId": "P07",
                "state": "你看见的是结果的连续反应与动作过渡",
                "holderId": "C06"
              }
            ],
            "environment": "铸剑师的警告",
            "lighting": "炉火侧光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "断剑平放铁砧，锤柄抵住断口"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "断剑平放铁砧，锤柄抵住断口"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "断剑平放铁砧，锤柄抵住断口"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "断剑平放铁砧，锤柄抵住断口",
                "holderId": "C01"
              },
              {
                "assetId": "P07",
                "state": "断剑平放铁砧，锤柄抵住断口",
                "holderId": "C06"
              }
            ],
            "environment": "铸剑师的警告",
            "lighting": "炉火侧光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH025-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频",
                "imagePrompt": "断剑平放铁砧，锤柄抵住断口，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实悬疑奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH025-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "Edia Knight内，门框在后上方、铁砧居中、炉膛后下方形成竖向纵深",
                "imagePrompt": "断剑平放铁砧，锤柄抵住断口，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Edia Knight内，门框在后上方、铁砧居中、炉膛后下方形成竖向纵深。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH025-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "Rifa守在门与Karin之间，Karin主动走向铁砧后她才让半步",
                "imagePrompt": "断剑平放铁砧，锤柄抵住断口，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa守在门与Karin之间，Karin主动走向铁砧后她才让半步。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH025-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "奥伦，灰白后梳长发、左眼皮革眼罩、深棕围裙、左臂黑护具，不看推荐信，问：“谁告诉你，它是被打断的？”Karin把断剑放上铁砧：“我看着它断的",
                "imagePrompt": "断剑平放铁砧，锤柄抵住断口，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：奥伦，灰白后梳长发、左眼皮革眼罩、深棕围裙、左臂黑护具，不看推荐信，问：“谁告诉你，它是被打断的？”Karin把断剑放上铁砧：“我看着它断的。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH025-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "”奥伦：“你看见的是结果",
                "imagePrompt": "断剑平放铁砧，锤柄抵住断口，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”奥伦：“你看见的是结果。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH025-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "”停一秒，无头锤柄抵住断口",
                "imagePrompt": "断剑平放铁砧，锤柄抵住断口，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”停一秒，无头锤柄抵住断口。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH025-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "50mm侧向短滑轨，煤黑与暗琥珀，口型同步，无字幕、无现代工具、无角色变形、无过量火花",
                "imagePrompt": "断剑平放铁砧，锤柄抵住断口，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：50mm侧向短滑轨，煤黑与暗琥珀，口型同步，无字幕、无现代工具、无角色变形、无过量火花。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH025-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "本内部镜头只执行：断剑平放铁砧，锤柄抵住断口",
                "imagePrompt": "断剑平放铁砧，锤柄抵住断口，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：本内部镜头只执行：断剑平放铁砧，锤柄抵住断口。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH025-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "保持角色、道具、轴线和前后状态连续",
                "imagePrompt": "断剑平放铁砧，锤柄抵住断口，MCU，炉火侧光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：保持角色、道具、轴线和前后状态连续。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH024"
              },
              {
                "alias": "@图片2",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S04"
              },
              {
                "alias": "@图片3",
                "role": "action_keyframe",
                "purpose": "动作关键帧：由本镜入口状态与动作起点派生，生成前需完成关键帧验收",
                "shotId": "SH025"
              }
            ]
          }
        },
        {
          "code": "SH026",
          "order": 26,
          "title": "借她的记忆 1/3",
          "description": "记忆显出暗红线",
          "sourceText": "Rifa守在门与Karin之间，直到Karin主动走向铁砧才让开半步。\n奥伦不看推荐信：“谁告诉你，它是被打断的？”\nKarin：“我看着它断的。”\n奥伦：“你看见的是结果。”\n无头锤柄碰触断口。炉火缩成一线，店内金属全部朝铁砧偏转。\n黑湖、倒塔、四只手。这一次，Karin看清其中一只手腕系着暗红细线。他转头看向Rifa的辫绳。Rifa立刻抓住他的手腕，幻象破碎。\n奥伦：“别放开。剑正在借她的记忆认你。”\nRifa：“你知道它为什么断？”\n奥伦取出带四点印记的木匣：“它不是断了。它在拒绝保持完整。”\n他把木匣推向Karin：“而你，不是第一个带它来这里的人。”\n铜镜中没有店内三人，只有高塔上的斗篷身影。Rifa的短刃滑出半寸。\nRifa：“上一个人是谁？”\n奥伦熄灭炉火。黑暗中，木匣再次耳语：“你又来迟了。”\n切黑。",
          "shotBoundary": "抓腕切回",
          "dialogue": "奥伦：别放开。剑正在借她的记忆认你。",
          "narration": "",
          "utterances": [
            {
              "id": "D23",
              "order": 1,
              "type": "dialogue",
              "speaker": "奥伦",
              "text": "别放开。剑正在借她的记忆认你。"
            }
          ],
          "imagePrompt": "记忆显出暗红线，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频。无头锤柄碰触断剑，炉火缩成一线，店内金属朝铁砧偏转。切入简洁记忆：黑湖、倒塔、雪地中央四只相握的手；其中一只手腕系暗红细线。Karin在记忆中看见红线，切回现实看向Rifa同色辫绳。Rifa立刻抓住他的手腕，幻象破碎。奥伦注视相接的手，说：“别放开。剑正在借她的记忆认你。”85mm慢推，只保留三项记忆意象，深蓝黑与炉火琥珀。口型同步，无字幕、无额外手指、无断手、无可辨识的其他三人面孔、无角色变形、无过载闪回。\n本内部镜头只执行：记忆显出暗红线。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "记忆慢推",
          "startFramePrompt": "记忆显出暗红线，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "Rifa抓住Karin，奥伦注视相接的手\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无额外手指、无断手、无可辨识的其他三人面孔、无角色变形、无过载闪回。",
          "continuity": {
            "shotSize": "CU→ECU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按记忆显出暗红线的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "记忆显出暗红线",
            "actionEnd": "Rifa抓住Karin，奥伦注视相接的手",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "抓腕切回"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02",
            "C06"
          ],
          "propCodes": [
            "P01",
            "P07"
          ],
          "clueCodes": [],
          "locationCode": "S04",
          "storySceneCode": "SC07",
          "timecode": "150-155s",
          "dramaticFunction": "双线汇合",
          "lens": "85mm",
          "lighting": "炉火收缩+冷光",
          "colorPalette": "琥珀→深蓝黑",
          "transitionOut": "抓腕切回",
          "performanceNotes": "别放开。剑正在借她的记忆认你。",
          "performancePlan": {
            "emotionalObjective": "围绕记忆显出暗红线完成当前镜头的外在行动目标",
            "emotionalArc": "从进入记忆显出暗红线的克制状态开始，经由动作反应推进，在Rifa抓住Karin，奥伦注视相接的手前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入记忆显出暗红线"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "Rifa抓住Karin，奥伦注视相接的手"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D23",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "别放开。剑正在借她的记忆认你。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "琥珀→深蓝黑",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "炉火收缩+冷光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "金属共鸣、记忆风声",
            "soundEffects": "Rifa抓腕、炉火收缩",
            "music": "女声母题短促上升后断开"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "断剑平放铁砧，锤柄抵住断口"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "断剑平放铁砧，锤柄抵住断口"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "断剑平放铁砧，锤柄抵住断口"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "断剑平放铁砧，锤柄抵住断口",
                "holderId": "C01"
              },
              {
                "assetId": "P07",
                "state": "断剑平放铁砧，锤柄抵住断口",
                "holderId": "C06"
              }
            ],
            "environment": "铸剑师的警告",
            "lighting": "炉火收缩+冷光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "记忆显出暗红线"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "记忆显出暗红线"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "记忆显出暗红线"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "记忆显出暗红线",
                "holderId": "C01"
              },
              {
                "assetId": "P07",
                "state": "记忆显出暗红线",
                "holderId": "C06"
              }
            ],
            "environment": "铸剑师的警告",
            "lighting": "炉火收缩+冷光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH026-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频",
                "imagePrompt": "记忆显出暗红线，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实悬疑奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH026-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "无头锤柄碰触断剑，炉火缩成一线，店内金属朝铁砧偏转",
                "imagePrompt": "记忆显出暗红线，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：无头锤柄碰触断剑，炉火缩成一线，店内金属朝铁砧偏转。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH026-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "切入简洁记忆：黑湖、倒塔、雪地中央四只相握的手",
                "imagePrompt": "记忆显出暗红线，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：切入简洁记忆：黑湖、倒塔、雪地中央四只相握的手。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH026-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "其中一只手腕系暗红细线",
                "imagePrompt": "记忆显出暗红线，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：其中一只手腕系暗红细线。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH026-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "Karin在记忆中看见红线，切回现实看向Rifa同色辫绳",
                "imagePrompt": "记忆显出暗红线，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin在记忆中看见红线，切回现实看向Rifa同色辫绳。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH026-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "Rifa立刻抓住他的手腕，幻象破碎",
                "imagePrompt": "记忆显出暗红线，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa立刻抓住他的手腕，幻象破碎。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH026-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "奥伦注视相接的手，说：“别放开",
                "imagePrompt": "记忆显出暗红线，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：奥伦注视相接的手，说：“别放开。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH026-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "剑正在借她的记忆认你",
                "imagePrompt": "记忆显出暗红线，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：剑正在借她的记忆认你。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH026-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "”85mm慢推，只保留三项记忆意象，深蓝黑与炉火琥珀",
                "imagePrompt": "记忆显出暗红线，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”85mm慢推，只保留三项记忆意象，深蓝黑与炉火琥珀。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH025"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Rifa 的身份特征、服装与道具不漂移",
                "assetId": "C02"
              },
              {
                "alias": "@图片4",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S04"
              }
            ]
          }
        },
        {
          "code": "SH027",
          "order": 27,
          "title": "借她的记忆 2/3",
          "description": "借她的记忆的连续反应与动作过渡",
          "sourceText": "Rifa守在门与Karin之间，直到Karin主动走向铁砧才让开半步。\n奥伦不看推荐信：“谁告诉你，它是被打断的？”\nKarin：“我看着它断的。”\n奥伦：“你看见的是结果。”\n无头锤柄碰触断口。炉火缩成一线，店内金属全部朝铁砧偏转。\n黑湖、倒塔、四只手。这一次，Karin看清其中一只手腕系着暗红细线。他转头看向Rifa的辫绳。Rifa立刻抓住他的手腕，幻象破碎。\n奥伦：“别放开。剑正在借她的记忆认你。”\nRifa：“你知道它为什么断？”\n奥伦取出带四点印记的木匣：“它不是断了。它在拒绝保持完整。”\n他把木匣推向Karin：“而你，不是第一个带它来这里的人。”\n铜镜中没有店内三人，只有高塔上的斗篷身影。Rifa的短刃滑出半寸。\nRifa：“上一个人是谁？”\n奥伦熄灭炉火。黑暗中，木匣再次耳语：“你又来迟了。”\n切黑。",
          "shotBoundary": "抓腕切回",
          "dialogue": "",
          "narration": "",
          "utterances": [],
          "imagePrompt": "借她的记忆的连续反应与动作过渡，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频。无头锤柄碰触断剑，炉火缩成一线，店内金属朝铁砧偏转。切入简洁记忆：黑湖、倒塔、雪地中央四只相握的手；其中一只手腕系暗红细线。Karin在记忆中看见红线，切回现实看向Rifa同色辫绳。Rifa立刻抓住他的手腕，幻象破碎。奥伦注视相接的手，说：“别放开。剑正在借她的记忆认你。”85mm慢推，只保留三项记忆意象，深蓝黑与炉火琥珀。口型同步，无字幕、无额外手指、无断手、无可辨识的其他三人面孔、无角色变形、无过载闪回。\n本内部镜头只执行：借她的记忆的连续反应与动作过渡。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "记忆慢推",
          "startFramePrompt": "记忆显出暗红线，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "Rifa抓住Karin，奥伦注视相接的手\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无额外手指、无断手、无可辨识的其他三人面孔、无角色变形、无过载闪回。",
          "continuity": {
            "shotSize": "CU→ECU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按记忆显出暗红线的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "记忆显出暗红线",
            "actionEnd": "Rifa抓住Karin，奥伦注视相接的手",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "抓腕切回"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02",
            "C06"
          ],
          "propCodes": [
            "P01",
            "P07"
          ],
          "clueCodes": [],
          "locationCode": "S04",
          "storySceneCode": "SC07",
          "timecode": "155-160s",
          "dramaticFunction": "双线汇合",
          "lens": "85mm",
          "lighting": "炉火收缩+冷光",
          "colorPalette": "琥珀→深蓝黑",
          "transitionOut": "抓腕切回",
          "performanceNotes": "别放开。剑正在借她的记忆认你。",
          "performancePlan": {
            "emotionalObjective": "围绕记忆显出暗红线完成当前镜头的外在行动目标",
            "emotionalArc": "从进入记忆显出暗红线的克制状态开始，经由动作反应推进，在Rifa抓住Karin，奥伦注视相接的手前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入记忆显出暗红线"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "Rifa抓住Karin，奥伦注视相接的手"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D23",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "别放开。剑正在借她的记忆认你。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "琥珀→深蓝黑",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "炉火收缩+冷光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "金属共鸣、记忆风声",
            "soundEffects": "Rifa抓腕、炉火收缩",
            "music": "女声母题短促上升后断开"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "记忆显出暗红线"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "记忆显出暗红线"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "记忆显出暗红线"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "记忆显出暗红线",
                "holderId": "C01"
              },
              {
                "assetId": "P07",
                "state": "记忆显出暗红线",
                "holderId": "C06"
              }
            ],
            "environment": "铸剑师的警告",
            "lighting": "炉火收缩+冷光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "借她的记忆的连续反应与动作过渡"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "借她的记忆的连续反应与动作过渡"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "借她的记忆的连续反应与动作过渡"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "借她的记忆的连续反应与动作过渡",
                "holderId": "C01"
              },
              {
                "assetId": "P07",
                "state": "借她的记忆的连续反应与动作过渡",
                "holderId": "C06"
              }
            ],
            "environment": "铸剑师的警告",
            "lighting": "炉火收缩+冷光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH027-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频",
                "imagePrompt": "借她的记忆的连续反应与动作过渡，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实悬疑奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH027-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "无头锤柄碰触断剑，炉火缩成一线，店内金属朝铁砧偏转",
                "imagePrompt": "借她的记忆的连续反应与动作过渡，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：无头锤柄碰触断剑，炉火缩成一线，店内金属朝铁砧偏转。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH027-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "切入简洁记忆：黑湖、倒塔、雪地中央四只相握的手",
                "imagePrompt": "借她的记忆的连续反应与动作过渡，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：切入简洁记忆：黑湖、倒塔、雪地中央四只相握的手。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH027-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "其中一只手腕系暗红细线",
                "imagePrompt": "借她的记忆的连续反应与动作过渡，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：其中一只手腕系暗红细线。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH027-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "Karin在记忆中看见红线，切回现实看向Rifa同色辫绳",
                "imagePrompt": "借她的记忆的连续反应与动作过渡，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin在记忆中看见红线，切回现实看向Rifa同色辫绳。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH027-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "Rifa立刻抓住他的手腕，幻象破碎",
                "imagePrompt": "借她的记忆的连续反应与动作过渡，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa立刻抓住他的手腕，幻象破碎。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH027-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "奥伦注视相接的手，说：“别放开",
                "imagePrompt": "借她的记忆的连续反应与动作过渡，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：奥伦注视相接的手，说：“别放开。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH027-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "剑正在借她的记忆认你",
                "imagePrompt": "借她的记忆的连续反应与动作过渡，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：剑正在借她的记忆认你。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH027-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "”85mm慢推，只保留三项记忆意象，深蓝黑与炉火琥珀",
                "imagePrompt": "借她的记忆的连续反应与动作过渡，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”85mm慢推，只保留三项记忆意象，深蓝黑与炉火琥珀。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH026"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Rifa 的身份特征、服装与道具不漂移",
                "assetId": "C02"
              },
              {
                "alias": "@图片4",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S04"
              }
            ]
          }
        },
        {
          "code": "SH028",
          "order": 28,
          "title": "借她的记忆 3/3",
          "description": "Rifa抓住Karin，奥伦注视相接的手",
          "sourceText": "Rifa守在门与Karin之间，直到Karin主动走向铁砧才让开半步。\n奥伦不看推荐信：“谁告诉你，它是被打断的？”\nKarin：“我看着它断的。”\n奥伦：“你看见的是结果。”\n无头锤柄碰触断口。炉火缩成一线，店内金属全部朝铁砧偏转。\n黑湖、倒塔、四只手。这一次，Karin看清其中一只手腕系着暗红细线。他转头看向Rifa的辫绳。Rifa立刻抓住他的手腕，幻象破碎。\n奥伦：“别放开。剑正在借她的记忆认你。”\nRifa：“你知道它为什么断？”\n奥伦取出带四点印记的木匣：“它不是断了。它在拒绝保持完整。”\n他把木匣推向Karin：“而你，不是第一个带它来这里的人。”\n铜镜中没有店内三人，只有高塔上的斗篷身影。Rifa的短刃滑出半寸。\nRifa：“上一个人是谁？”\n奥伦熄灭炉火。黑暗中，木匣再次耳语：“你又来迟了。”\n切黑。",
          "shotBoundary": "抓腕切回",
          "dialogue": "",
          "narration": "",
          "utterances": [],
          "imagePrompt": "Rifa抓住Karin，奥伦注视相接的手，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频。无头锤柄碰触断剑，炉火缩成一线，店内金属朝铁砧偏转。切入简洁记忆：黑湖、倒塔、雪地中央四只相握的手；其中一只手腕系暗红细线。Karin在记忆中看见红线，切回现实看向Rifa同色辫绳。Rifa立刻抓住他的手腕，幻象破碎。奥伦注视相接的手，说：“别放开。剑正在借她的记忆认你。”85mm慢推，只保留三项记忆意象，深蓝黑与炉火琥珀。口型同步，无字幕、无额外手指、无断手、无可辨识的其他三人面孔、无角色变形、无过载闪回。\n本内部镜头只执行：Rifa抓住Karin，奥伦注视相接的手。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "记忆慢推",
          "startFramePrompt": "记忆显出暗红线，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "Rifa抓住Karin，奥伦注视相接的手\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无额外手指、无断手、无可辨识的其他三人面孔、无角色变形、无过载闪回。",
          "continuity": {
            "shotSize": "CU→ECU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按记忆显出暗红线的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "记忆显出暗红线",
            "actionEnd": "Rifa抓住Karin，奥伦注视相接的手",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "抓腕切回"
          },
          "duration": 5,
          "characterCodes": [
            "C01",
            "C02",
            "C06"
          ],
          "propCodes": [
            "P01",
            "P07"
          ],
          "clueCodes": [],
          "locationCode": "S04",
          "storySceneCode": "SC07",
          "timecode": "160-165s",
          "dramaticFunction": "双线汇合",
          "lens": "85mm",
          "lighting": "炉火收缩+冷光",
          "colorPalette": "琥珀→深蓝黑",
          "transitionOut": "抓腕切回",
          "performanceNotes": "别放开。剑正在借她的记忆认你。",
          "performancePlan": {
            "emotionalObjective": "围绕记忆显出暗红线完成当前镜头的外在行动目标",
            "emotionalArc": "从进入记忆显出暗红线的克制状态开始，经由动作反应推进，在Rifa抓住Karin，奥伦注视相接的手前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入记忆显出暗红线"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "Rifa抓住Karin，奥伦注视相接的手"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D23",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "别放开。剑正在借她的记忆认你。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "琥珀→深蓝黑",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "炉火收缩+冷光作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "金属共鸣、记忆风声",
            "soundEffects": "Rifa抓腕、炉火收缩",
            "music": "女声母题短促上升后断开"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "借她的记忆的连续反应与动作过渡"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "借她的记忆的连续反应与动作过渡"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "借她的记忆的连续反应与动作过渡"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "借她的记忆的连续反应与动作过渡",
                "holderId": "C01"
              },
              {
                "assetId": "P07",
                "state": "借她的记忆的连续反应与动作过渡",
                "holderId": "C06"
              }
            ],
            "environment": "铸剑师的警告",
            "lighting": "炉火收缩+冷光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Rifa抓住Karin，奥伦注视相接的手"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Rifa抓住Karin，奥伦注视相接的手"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Rifa抓住Karin，奥伦注视相接的手"
              }
            ],
            "props": [
              {
                "assetId": "P01",
                "state": "Rifa抓住Karin，奥伦注视相接的手",
                "holderId": "C01"
              },
              {
                "assetId": "P07",
                "state": "Rifa抓住Karin，奥伦注视相接的手",
                "holderId": "C06"
              }
            ],
            "environment": "铸剑师的警告",
            "lighting": "炉火收缩+冷光",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH028-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.556,
                "actionPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频",
                "imagePrompt": "Rifa抓住Karin，奥伦注视相接的手，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实悬疑奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH028-F02",
                "sequenceIndex": 2,
                "startSecond": 0.556,
                "endSecond": 1.111,
                "actionPrompt": "无头锤柄碰触断剑，炉火缩成一线，店内金属朝铁砧偏转",
                "imagePrompt": "Rifa抓住Karin，奥伦注视相接的手，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：无头锤柄碰触断剑，炉火缩成一线，店内金属朝铁砧偏转。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH028-F03",
                "sequenceIndex": 3,
                "startSecond": 1.111,
                "endSecond": 1.667,
                "actionPrompt": "切入简洁记忆：黑湖、倒塔、雪地中央四只相握的手",
                "imagePrompt": "Rifa抓住Karin，奥伦注视相接的手，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：切入简洁记忆：黑湖、倒塔、雪地中央四只相握的手。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH028-F04",
                "sequenceIndex": 4,
                "startSecond": 1.667,
                "endSecond": 2.222,
                "actionPrompt": "其中一只手腕系暗红细线",
                "imagePrompt": "Rifa抓住Karin，奥伦注视相接的手，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：其中一只手腕系暗红细线。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH028-F05",
                "sequenceIndex": 5,
                "startSecond": 2.222,
                "endSecond": 2.778,
                "actionPrompt": "Karin在记忆中看见红线，切回现实看向Rifa同色辫绳",
                "imagePrompt": "Rifa抓住Karin，奥伦注视相接的手，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Karin在记忆中看见红线，切回现实看向Rifa同色辫绳。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH028-F06",
                "sequenceIndex": 6,
                "startSecond": 2.778,
                "endSecond": 3.333,
                "actionPrompt": "Rifa立刻抓住他的手腕，幻象破碎",
                "imagePrompt": "Rifa抓住Karin，奥伦注视相接的手，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa立刻抓住他的手腕，幻象破碎。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH028-F07",
                "sequenceIndex": 7,
                "startSecond": 3.333,
                "endSecond": 3.889,
                "actionPrompt": "奥伦注视相接的手，说：“别放开",
                "imagePrompt": "Rifa抓住Karin，奥伦注视相接的手，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：奥伦注视相接的手，说：“别放开。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH028-F08",
                "sequenceIndex": 8,
                "startSecond": 3.889,
                "endSecond": 4.444,
                "actionPrompt": "剑正在借她的记忆认你",
                "imagePrompt": "Rifa抓住Karin，奥伦注视相接的手，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：剑正在借她的记忆认你。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH028-F09",
                "sequenceIndex": 9,
                "startSecond": 4.444,
                "endSecond": 5,
                "actionPrompt": "”85mm慢推，只保留三项记忆意象，深蓝黑与炉火琥珀",
                "imagePrompt": "Rifa抓住Karin，奥伦注视相接的手，CU→ECU，炉火收缩+冷光，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”85mm慢推，只保留三项记忆意象，深蓝黑与炉火琥珀。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH027"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Karin 的身份特征、服装与道具不漂移",
                "assetId": "C01"
              },
              {
                "alias": "@图片3",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Rifa 的身份特征、服装与道具不漂移",
                "assetId": "C02"
              },
              {
                "alias": "@图片4",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S04"
              }
            ]
          }
        },
        {
          "code": "SH029",
          "order": 29,
          "title": "拒绝完整 1/2",
          "description": "答案与新问题",
          "sourceText": "Rifa守在门与Karin之间，直到Karin主动走向铁砧才让开半步。\n奥伦不看推荐信：“谁告诉你，它是被打断的？”\nKarin：“我看着它断的。”\n奥伦：“你看见的是结果。”\n无头锤柄碰触断口。炉火缩成一线，店内金属全部朝铁砧偏转。\n黑湖、倒塔、四只手。这一次，Karin看清其中一只手腕系着暗红细线。他转头看向Rifa的辫绳。Rifa立刻抓住他的手腕，幻象破碎。\n奥伦：“别放开。剑正在借她的记忆认你。”\nRifa：“你知道它为什么断？”\n奥伦取出带四点印记的木匣：“它不是断了。它在拒绝保持完整。”\n他把木匣推向Karin：“而你，不是第一个带它来这里的人。”\n铜镜中没有店内三人，只有高塔上的斗篷身影。Rifa的短刃滑出半寸。\nRifa：“上一个人是谁？”\n奥伦熄灭炉火。黑暗中，木匣再次耳语：“你又来迟了。”\n切黑。",
          "shotBoundary": "熄火切黑",
          "dialogue": "Rifa：你知道它为什么断？\n奥伦：它不是断了。它在拒绝保持完整。\n奥伦：而你，不是第一个带它来这里的人。",
          "narration": "",
          "utterances": [
            {
              "id": "D24",
              "order": 1,
              "type": "dialogue",
              "speaker": "Rifa",
              "text": "你知道它为什么断？"
            },
            {
              "id": "D25",
              "order": 2,
              "type": "dialogue",
              "speaker": "奥伦",
              "text": "它不是断了。它在拒绝保持完整。"
            },
            {
              "id": "D26",
              "order": 3,
              "type": "dialogue",
              "speaker": "奥伦",
              "text": "而你，不是第一个带它来这里的人。"
            }
          ],
          "imagePrompt": "答案与新问题，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频。延续Rifa抓住Karin手腕。Rifa问：“你知道它为什么断？”奥伦从铁砧下取出带银裂痕与四点印记的窄木匣：“它不是断了。它在拒绝保持完整。”停一秒半，他把木匣推向Karin：“而你，不是第一个带它来这里的人。”上方烟黑铜镜只映出高塔斗篷观察者。Rifa短刃滑出半寸：“上一个人是谁？”奥伦熄灭炉火。黑暗中木匣四点微亮，耳语：“你又来迟了。”85mm沿竖向铁砧慢推，暗琥珀转冷紫黑。口型同步，无字幕、无过量闪回、无额外手指、无现代工具、无水印logo、观察者不露脸，结尾切黑。\n本内部镜头只执行：答案与新问题。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "木匣慢推",
          "startFramePrompt": "答案与新问题，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无过量闪回、无额外手指、无现代工具、无水印logo、观察者不露脸，结尾切黑。",
          "continuity": {
            "shotSize": "MCU→ECU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按答案与新问题的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "答案与新问题",
            "actionEnd": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "熄火切黑"
          },
          "duration": 7.5,
          "characterCodes": [
            "C01",
            "C02",
            "C06",
            "C07"
          ],
          "propCodes": [
            "P04",
            "P05",
            "P08"
          ],
          "clueCodes": [],
          "locationCode": "S04",
          "storySceneCode": "SC07",
          "timecode": "165-172.5s",
          "dramaticFunction": "悬念钩子",
          "lens": "85mm",
          "lighting": "炉火熄灭",
          "colorPalette": "暗琥珀→冷紫黑",
          "transitionOut": "熄火切黑",
          "performanceNotes": "你知道它为什么断？；它不是断了。它在拒绝保持完整。；而你，不是第一个带它来这里的人。；上一个人是谁？；你又来迟了。",
          "performancePlan": {
            "emotionalObjective": "围绕答案与新问题完成当前镜头的外在行动目标",
            "emotionalArc": "从进入答案与新问题的克制状态开始，经由动作反应推进，在木匣四点微亮，铜镜现观察者，短刃出鞘半寸前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入答案与新问题"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D24",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "你知道它为什么断？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D25",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "它不是断了。它在拒绝保持完整。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D26",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "而你，不是第一个带它来这里的人。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D27",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "上一个人是谁？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "暗琥珀→冷紫黑",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "炉火熄灭作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "店外声音像隔水",
            "soundEffects": "木匣滑动、短刃半出鞘、熄火",
            "music": "冷低弦与耳语后绝对静音"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Rifa抓住Karin，奥伦注视相接的手"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Rifa抓住Karin，奥伦注视相接的手"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "Rifa抓住Karin，奥伦注视相接的手"
              },
              {
                "assetId": "C07",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "进入答案与新问题"
              }
            ],
            "props": [
              {
                "assetId": "P04",
                "state": "进入答案与新问题",
                "holderId": "C06"
              },
              {
                "assetId": "P05",
                "state": "进入答案与新问题",
                "holderId": "C02"
              },
              {
                "assetId": "P08",
                "state": "进入答案与新问题",
                "holderId": "C06"
              }
            ],
            "environment": "铸剑师的警告",
            "lighting": "炉火熄灭",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "答案与新问题"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "答案与新问题"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "答案与新问题"
              },
              {
                "assetId": "C07",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "答案与新问题"
              }
            ],
            "props": [
              {
                "assetId": "P04",
                "state": "答案与新问题",
                "holderId": "C06"
              },
              {
                "assetId": "P05",
                "state": "答案与新问题",
                "holderId": "C02"
              },
              {
                "assetId": "P08",
                "state": "答案与新问题",
                "holderId": "C06"
              }
            ],
            "environment": "铸剑师的警告",
            "lighting": "炉火熄灭",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH029-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.833,
                "actionPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频",
                "imagePrompt": "答案与新问题，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实悬疑奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH029-F02",
                "sequenceIndex": 2,
                "startSecond": 0.833,
                "endSecond": 1.667,
                "actionPrompt": "延续Rifa抓住Karin手腕",
                "imagePrompt": "答案与新问题，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：延续Rifa抓住Karin手腕。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH029-F03",
                "sequenceIndex": 3,
                "startSecond": 1.667,
                "endSecond": 2.5,
                "actionPrompt": "Rifa问：“你知道它为什么断？”奥伦从铁砧下取出带银裂痕与四点印记的窄木匣：“它不是断了",
                "imagePrompt": "答案与新问题，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa问：“你知道它为什么断？”奥伦从铁砧下取出带银裂痕与四点印记的窄木匣：“它不是断了。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH029-F04",
                "sequenceIndex": 4,
                "startSecond": 2.5,
                "endSecond": 3.333,
                "actionPrompt": "它在拒绝保持完整",
                "imagePrompt": "答案与新问题，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：它在拒绝保持完整。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH029-F05",
                "sequenceIndex": 5,
                "startSecond": 3.333,
                "endSecond": 4.167,
                "actionPrompt": "”停一秒半，他把木匣推向Karin：“而你，不是第一个带它来这里的人",
                "imagePrompt": "答案与新问题，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”停一秒半，他把木匣推向Karin：“而你，不是第一个带它来这里的人。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH029-F06",
                "sequenceIndex": 6,
                "startSecond": 4.167,
                "endSecond": 5,
                "actionPrompt": "”上方烟黑铜镜只映出高塔斗篷观察者",
                "imagePrompt": "答案与新问题，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”上方烟黑铜镜只映出高塔斗篷观察者。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH029-F07",
                "sequenceIndex": 7,
                "startSecond": 5,
                "endSecond": 5.833,
                "actionPrompt": "Rifa短刃滑出半寸：“上一个人是谁？”奥伦熄灭炉火",
                "imagePrompt": "答案与新问题，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa短刃滑出半寸：“上一个人是谁？”奥伦熄灭炉火。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH029-F08",
                "sequenceIndex": 8,
                "startSecond": 5.833,
                "endSecond": 6.667,
                "actionPrompt": "黑暗中木匣四点微亮，耳语：“你又来迟了",
                "imagePrompt": "答案与新问题，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：黑暗中木匣四点微亮，耳语：“你又来迟了。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH029-F09",
                "sequenceIndex": 9,
                "startSecond": 6.667,
                "endSecond": 7.5,
                "actionPrompt": "”85mm沿竖向铁砧慢推，暗琥珀转冷紫黑",
                "imagePrompt": "答案与新问题，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”85mm沿竖向铁砧慢推，暗琥珀转冷紫黑。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH028"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Rifa 的身份特征、服装与道具不漂移",
                "assetId": "C02"
              },
              {
                "alias": "@图片3",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S04"
              }
            ]
          }
        },
        {
          "code": "SH030",
          "order": 30,
          "title": "拒绝完整 2/2",
          "description": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸",
          "sourceText": "Rifa守在门与Karin之间，直到Karin主动走向铁砧才让开半步。\n奥伦不看推荐信：“谁告诉你，它是被打断的？”\nKarin：“我看着它断的。”\n奥伦：“你看见的是结果。”\n无头锤柄碰触断口。炉火缩成一线，店内金属全部朝铁砧偏转。\n黑湖、倒塔、四只手。这一次，Karin看清其中一只手腕系着暗红细线。他转头看向Rifa的辫绳。Rifa立刻抓住他的手腕，幻象破碎。\n奥伦：“别放开。剑正在借她的记忆认你。”\nRifa：“你知道它为什么断？”\n奥伦取出带四点印记的木匣：“它不是断了。它在拒绝保持完整。”\n他把木匣推向Karin：“而你，不是第一个带它来这里的人。”\n铜镜中没有店内三人，只有高塔上的斗篷身影。Rifa的短刃滑出半寸。\nRifa：“上一个人是谁？”\n奥伦熄灭炉火。黑暗中，木匣再次耳语：“你又来迟了。”\n切黑。",
          "shotBoundary": "熄火切黑",
          "dialogue": "Rifa：上一个人是谁？",
          "narration": "记忆：你又来迟了。",
          "utterances": [
            {
              "id": "D27",
              "order": 1,
              "type": "dialogue",
              "speaker": "Rifa",
              "text": "上一个人是谁？"
            },
            {
              "id": "D28",
              "order": 2,
              "type": "voiceover",
              "speaker": "记忆",
              "text": "你又来迟了。"
            }
          ],
          "imagePrompt": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白",
          "videoPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频。延续Rifa抓住Karin手腕。Rifa问：“你知道它为什么断？”奥伦从铁砧下取出带银裂痕与四点印记的窄木匣：“它不是断了。它在拒绝保持完整。”停一秒半，他把木匣推向Karin：“而你，不是第一个带它来这里的人。”上方烟黑铜镜只映出高塔斗篷观察者。Rifa短刃滑出半寸：“上一个人是谁？”奥伦熄灭炉火。黑暗中木匣四点微亮，耳语：“你又来迟了。”85mm沿竖向铁砧慢推，暗琥珀转冷紫黑。口型同步，无字幕、无过量闪回、无额外手指、无现代工具、无水印logo、观察者不露脸，结尾切黑。\n本内部镜头只执行：木匣四点微亮，铜镜现观察者，短刃出鞘半寸。保持角色、道具、轴线和前后状态连续。",
          "cameraMotion": "木匣慢推",
          "startFramePrompt": "答案与新问题，动作起始状态\n连续性硬约束：仅以@图片1（上一镜已验收实际尾帧）作为首要入口依据。",
          "endFramePrompt": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸\n出口状态必须可被下一镜继承，生成后保存当前视频版本实际尾帧并人工验收。",
          "negativePrompt": "无字幕、无过量闪回、无额外手指、无现代工具、无水印logo、观察者不露脸，结尾切黑。",
          "continuity": {
            "shotSize": "MCU→ECU",
            "cameraAngle": "视线高度平视，沿动作轴线拍摄",
            "composition": "主体保持在9:16安全区，动作方向留出前进空间",
            "characterBlocking": "按答案与新问题的动作关系安排站位",
            "gazeDirection": "沿叙事动作方向，反应时回看对手或关键道具",
            "actionStart": "答案与新问题",
            "actionEnd": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸",
            "screenDirection": "保持同侧屏幕运动方向",
            "axisRule": "保持180度关系轴线，转场时明确切换",
            "continuityNotes": "熄火切黑"
          },
          "duration": 7.5,
          "characterCodes": [
            "C01",
            "C02",
            "C06",
            "C07"
          ],
          "propCodes": [
            "P04",
            "P05",
            "P08"
          ],
          "clueCodes": [],
          "locationCode": "S04",
          "storySceneCode": "SC07",
          "timecode": "172.5-180s",
          "dramaticFunction": "悬念钩子",
          "lens": "85mm",
          "lighting": "炉火熄灭",
          "colorPalette": "暗琥珀→冷紫黑",
          "transitionOut": "熄火切黑",
          "performanceNotes": "你知道它为什么断？；它不是断了。它在拒绝保持完整。；而你，不是第一个带它来这里的人。；上一个人是谁？；你又来迟了。",
          "performancePlan": {
            "emotionalObjective": "围绕答案与新问题完成当前镜头的外在行动目标",
            "emotionalArc": "从进入答案与新问题的克制状态开始，经由动作反应推进，在木匣四点微亮，铜镜现观察者，短刃出鞘半寸前收束",
            "speechStyle": "台词贴合当下处境，语气清晰克制，重音落在行动关键信息",
            "pace": "按镜头时长均匀推进，动作变化处短暂停顿，转场前收住",
            "breath": "起始自然吸气，动作变化处短暂停顿，结束以呼气完成收束",
            "restraintLevel": "中等克制，避免夸张表演",
            "beats": {
              "start": {
                "emotion": "保持与上一状态一致",
                "facialAction": "眉眼和下颌保持可读的初始反应",
                "gaze": "沿当前镜头动作方向",
                "bodyAction": "进入答案与新问题"
              },
              "middle": {
                "emotion": "压力或目标逐步显现",
                "facialAction": "眉眼、嘴角或下颌出现与动作对应的细微变化",
                "gaze": "短暂聚焦关键人物或道具",
                "bodyAction": "完成主要动作并保留反应停顿"
              },
              "end": {
                "emotion": "在下一镜头切点前完成情绪落点",
                "facialAction": "固定最终表情，避免切点前漂移",
                "gaze": "指向下一动作或转场方向",
                "bodyAction": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸"
              }
            }
          },
          "dialoguePerformance": [
            {
              "utteranceId": "D27",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "上一个人是谁？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D24",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "你知道它为什么断？",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D25",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "它不是断了。它在拒绝保持完整。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            },
            {
              "utteranceId": "D26",
              "intent": "推动当前镜头行动并回应对手或环境",
              "tone": "贴合当前情绪，清晰自然",
              "pace": "按语义分句，中速完成",
              "pause": "关键信息前短停，句末自然收束",
              "emphasis": "而你，不是第一个带它来这里的人。",
              "facialReactionBefore": "先以视线和眉眼确认对方或关键道具",
              "facialReactionDuring": "说话时保持与行动一致的面部反应",
              "facialReactionAfter": "说完保留短暂反应，衔接下一动作"
            }
          ],
          "lightingPlan": {
            "palette": "暗琥珀→冷紫黑",
            "colorTemperature": "主光冷暖关系沿用本场设定，避免相邻镜头跳变",
            "keyLight": "炉火熄灭作为主光，明确来自画面主方向并照亮主体面部",
            "fillLight": "弱补光保留面部细节，阴影侧不完全压黑",
            "rimLight": "以轻微轮廓光分离人物与背景，不制造硬边光晕",
            "contrast": "中等反差，主体层次清晰，避免高光溢出",
            "materialResponse": "金属、皮革和织物按真实材质反射，亮部克制",
            "skinToneProtection": "保护肤色自然，不被环境色完全染色",
            "inheritFromPrevious": "继承上一镜主光方向、色温和环境亮度",
            "transitionToNext": "在动作结束处平滑过渡到下一镜主光和色板"
          },
          "sound": {
            "ambience": "店外声音像隔水",
            "soundEffects": "木匣滑动、短刃半出鞘、熄火",
            "music": "冷低弦与耳语后绝对静音"
          },
          "entryState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "答案与新问题"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "答案与新问题"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "答案与新问题"
              },
              {
                "assetId": "C07",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "答案与新问题"
              }
            ],
            "props": [
              {
                "assetId": "P04",
                "state": "答案与新问题",
                "holderId": "C06"
              },
              {
                "assetId": "P05",
                "state": "答案与新问题",
                "holderId": "C02"
              },
              {
                "assetId": "P08",
                "state": "答案与新问题",
                "holderId": "C06"
              }
            ],
            "environment": "铸剑师的警告",
            "lighting": "炉火熄灭",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "exitState": {
            "characters": [
              {
                "assetId": "C01",
                "wardrobe": "系列圣经标准造型",
                "position": "画面左侧或前景",
                "gaze": "沿镜头轴线向右",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸"
              },
              {
                "assetId": "C02",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸"
              },
              {
                "assetId": "C06",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸"
              },
              {
                "assetId": "C07",
                "wardrobe": "系列圣经标准造型",
                "position": "画面右侧或后景",
                "gaze": "沿镜头轴线向左",
                "pose": "克制站姿或自然坐姿",
                "expression": "按本镜表演说明",
                "action": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸"
              }
            ],
            "props": [
              {
                "assetId": "P04",
                "state": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸",
                "holderId": "C06"
              },
              {
                "assetId": "P05",
                "state": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸",
                "holderId": "C02"
              },
              {
                "assetId": "P08",
                "state": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸",
                "holderId": "C06"
              }
            ],
            "environment": "铸剑师的警告",
            "lighting": "炉火熄灭",
            "axis": "保持180度人物关系轴线",
            "screenDirection": "角色移动方向沿场景既定动线"
          },
          "sourceAssetIds": [],
          "continuityStatus": "planned",
          "videoMode": "reference",
          "storyboardFrameMode": "all_frames",
          "framePlan": {
            "start": {
              "source": "previous_accepted_actual_tail"
            },
            "end": {
              "required": true
            },
            "frames": [
              {
                "id": "SH030-F01",
                "sequenceIndex": 1,
                "startSecond": 0,
                "endSecond": 0.833,
                "actionPrompt": "生成15秒9:16竖屏电影级写实悬疑奇幻视频",
                "imagePrompt": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：生成15秒9:16竖屏电影级写实悬疑奇幻视频。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH030-F02",
                "sequenceIndex": 2,
                "startSecond": 0.833,
                "endSecond": 1.667,
                "actionPrompt": "延续Rifa抓住Karin手腕",
                "imagePrompt": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：延续Rifa抓住Karin手腕。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH030-F03",
                "sequenceIndex": 3,
                "startSecond": 1.667,
                "endSecond": 2.5,
                "actionPrompt": "Rifa问：“你知道它为什么断？”奥伦从铁砧下取出带银裂痕与四点印记的窄木匣：“它不是断了",
                "imagePrompt": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa问：“你知道它为什么断？”奥伦从铁砧下取出带银裂痕与四点印记的窄木匣：“它不是断了。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH030-F04",
                "sequenceIndex": 4,
                "startSecond": 2.5,
                "endSecond": 3.333,
                "actionPrompt": "它在拒绝保持完整",
                "imagePrompt": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：它在拒绝保持完整。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH030-F05",
                "sequenceIndex": 5,
                "startSecond": 3.333,
                "endSecond": 4.167,
                "actionPrompt": "”停一秒半，他把木匣推向Karin：“而你，不是第一个带它来这里的人",
                "imagePrompt": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”停一秒半，他把木匣推向Karin：“而你，不是第一个带它来这里的人。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH030-F06",
                "sequenceIndex": 6,
                "startSecond": 4.167,
                "endSecond": 5,
                "actionPrompt": "”上方烟黑铜镜只映出高塔斗篷观察者",
                "imagePrompt": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”上方烟黑铜镜只映出高塔斗篷观察者。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH030-F07",
                "sequenceIndex": 7,
                "startSecond": 5,
                "endSecond": 5.833,
                "actionPrompt": "Rifa短刃滑出半寸：“上一个人是谁？”奥伦熄灭炉火",
                "imagePrompt": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：Rifa短刃滑出半寸：“上一个人是谁？”奥伦熄灭炉火。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH030-F08",
                "sequenceIndex": 8,
                "startSecond": 5.833,
                "endSecond": 6.667,
                "actionPrompt": "黑暗中木匣四点微亮，耳语：“你又来迟了",
                "imagePrompt": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：黑暗中木匣四点微亮，耳语：“你又来迟了。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              },
              {
                "id": "SH030-F09",
                "sequenceIndex": 9,
                "startSecond": 6.667,
                "endSecond": 7.5,
                "actionPrompt": "”85mm沿竖向铁砧慢推，暗琥珀转冷紫黑",
                "imagePrompt": "木匣四点微亮，铜镜现观察者，短刃出鞘半寸，MCU→ECU，炉火熄灭，9:16安全构图，人物头顶与底部字幕区留白。当前时段动作锚点：”85mm沿竖向铁砧慢推，暗琥珀转冷紫黑。保持角色身份、服装、道具、场景结构、光向、构图和轴线与上一帧连续。"
              }
            ],
            "referenceCount": {
              "min": 3,
              "max": 5
            },
            "referenceManifest": [
              {
                "alias": "@图片1",
                "role": "previous_actual_tail",
                "purpose": "上一镜当前视频版本的已人工验收实际尾帧，仅作为本镜唯一连续性锚点",
                "shotId": "SH029"
              },
              {
                "alias": "@图片2",
                "role": "character_anchor",
                "purpose": "角色基准图：保持 Rifa 的身份特征、服装与道具不漂移",
                "assetId": "C02"
              },
              {
                "alias": "@图片3",
                "role": "scene_anchor",
                "purpose": "场景基准图：保持空间结构、光向与轴线一致",
                "assetId": "S04"
              }
            ]
          }
        }
      ],
      "continuityEdges": [
        {
          "fromShotCode": "SH001",
          "toShotCode": "SH002",
          "transition": "match_cut",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01"
          ],
          "carryPropIds": [
            "P01"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "睁眼匹配切"
        },
        {
          "fromShotCode": "SH002",
          "toShotCode": "SH003",
          "transition": "scene_change",
          "inheritActualEndFrame": false,
          "carryCharacterIds": [
            "C01"
          ],
          "carryPropIds": [
            "P01"
          ],
          "carryEnvironment": false,
          "carryAxis": false,
          "notes": "睁眼匹配切"
        },
        {
          "fromShotCode": "SH003",
          "toShotCode": "SH004",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02"
          ],
          "carryPropIds": [
            "P01"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "水囊动作切"
        },
        {
          "fromShotCode": "SH004",
          "toShotCode": "SH005",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02"
          ],
          "carryPropIds": [
            "P01"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "水囊动作切"
        },
        {
          "fromShotCode": "SH005",
          "toShotCode": "SH006",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02"
          ],
          "carryPropIds": [],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "水囊动作切"
        },
        {
          "fromShotCode": "SH006",
          "toShotCode": "SH007",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02"
          ],
          "carryPropIds": [
            "P02"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "护符熄灭切"
        },
        {
          "fromShotCode": "SH007",
          "toShotCode": "SH008",
          "transition": "scene_change",
          "inheritActualEndFrame": false,
          "carryCharacterIds": [
            "C01",
            "C02"
          ],
          "carryPropIds": [
            "P02"
          ],
          "carryEnvironment": false,
          "carryAxis": false,
          "notes": "护符熄灭切"
        },
        {
          "fromShotCode": "SH008",
          "toShotCode": "SH009",
          "transition": "match_cut",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02",
            "C05"
          ],
          "carryPropIds": [
            "P02",
            "P03"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "指针匹配切"
        },
        {
          "fromShotCode": "SH009",
          "toShotCode": "SH010",
          "transition": "match_cut",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02",
            "C05"
          ],
          "carryPropIds": [
            "P03"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "指针匹配切"
        },
        {
          "fromShotCode": "SH010",
          "toShotCode": "SH011",
          "transition": "hard_cut",
          "inheritActualEndFrame": false,
          "carryCharacterIds": [
            "C01",
            "C02",
            "C05"
          ],
          "carryPropIds": [
            "P03"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "锁链硬切"
        },
        {
          "fromShotCode": "SH011",
          "toShotCode": "SH012",
          "transition": "hard_cut",
          "inheritActualEndFrame": false,
          "carryCharacterIds": [
            "C01",
            "C02",
            "C05"
          ],
          "carryPropIds": [
            "P03"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "锁链硬切"
        },
        {
          "fromShotCode": "SH012",
          "toShotCode": "SH013",
          "transition": "scene_change",
          "inheritActualEndFrame": false,
          "carryCharacterIds": [
            "C01",
            "C02"
          ],
          "carryPropIds": [],
          "carryEnvironment": false,
          "carryAxis": false,
          "notes": "锁链硬切"
        },
        {
          "fromShotCode": "SH013",
          "toShotCode": "SH014",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02"
          ],
          "carryPropIds": [
            "P01"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "拇指动作切"
        },
        {
          "fromShotCode": "SH014",
          "toShotCode": "SH015",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02"
          ],
          "carryPropIds": [],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "拇指动作切"
        },
        {
          "fromShotCode": "SH015",
          "toShotCode": "SH016",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02",
            "C05",
            "C07"
          ],
          "carryPropIds": [
            "P03",
            "P06"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "声音骤停"
        },
        {
          "fromShotCode": "SH016",
          "toShotCode": "SH017",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02",
            "C05",
            "C07"
          ],
          "carryPropIds": [
            "P03",
            "P06"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "声音骤停"
        },
        {
          "fromShotCode": "SH017",
          "toShotCode": "SH018",
          "transition": "scene_change",
          "inheritActualEndFrame": false,
          "carryCharacterIds": [
            "C01",
            "C02"
          ],
          "carryPropIds": [],
          "carryEnvironment": false,
          "carryAxis": false,
          "notes": "声音骤停"
        },
        {
          "fromShotCode": "SH018",
          "toShotCode": "SH019",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02"
          ],
          "carryPropIds": [
            "P01"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "碰剑声切"
        },
        {
          "fromShotCode": "SH019",
          "toShotCode": "SH020",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02"
          ],
          "carryPropIds": [
            "P01"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "碰剑声切"
        },
        {
          "fromShotCode": "SH020",
          "toShotCode": "SH021",
          "transition": "scene_change",
          "inheritActualEndFrame": false,
          "carryCharacterIds": [
            "C01",
            "C02"
          ],
          "carryPropIds": [
            "P01"
          ],
          "carryEnvironment": false,
          "carryAxis": false,
          "notes": "碰剑声切"
        },
        {
          "fromShotCode": "SH021",
          "toShotCode": "SH022",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02",
            "C06"
          ],
          "carryPropIds": [
            "P01"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "门开切内景"
        },
        {
          "fromShotCode": "SH022",
          "toShotCode": "SH023",
          "transition": "scene_change",
          "inheritActualEndFrame": false,
          "carryCharacterIds": [
            "C01",
            "C02",
            "C06"
          ],
          "carryPropIds": [
            "P01"
          ],
          "carryEnvironment": false,
          "carryAxis": false,
          "notes": "门开切内景"
        },
        {
          "fromShotCode": "SH023",
          "toShotCode": "SH024",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02",
            "C06"
          ],
          "carryPropIds": [
            "P01",
            "P07"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "锤柄触剑切"
        },
        {
          "fromShotCode": "SH024",
          "toShotCode": "SH025",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02",
            "C06"
          ],
          "carryPropIds": [
            "P01",
            "P07"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "锤柄触剑切"
        },
        {
          "fromShotCode": "SH025",
          "toShotCode": "SH026",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02",
            "C06"
          ],
          "carryPropIds": [
            "P01",
            "P07"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "锤柄触剑切"
        },
        {
          "fromShotCode": "SH026",
          "toShotCode": "SH027",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02",
            "C06"
          ],
          "carryPropIds": [
            "P01",
            "P07"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "抓腕切回"
        },
        {
          "fromShotCode": "SH027",
          "toShotCode": "SH028",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02",
            "C06"
          ],
          "carryPropIds": [
            "P01",
            "P07"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "抓腕切回"
        },
        {
          "fromShotCode": "SH028",
          "toShotCode": "SH029",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02",
            "C06"
          ],
          "carryPropIds": [],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "抓腕切回"
        },
        {
          "fromShotCode": "SH029",
          "toShotCode": "SH030",
          "transition": "continuous",
          "inheritActualEndFrame": true,
          "carryCharacterIds": [
            "C01",
            "C02",
            "C06",
            "C07"
          ],
          "carryPropIds": [
            "P04",
            "P05",
            "P08"
          ],
          "carryEnvironment": true,
          "carryAxis": true,
          "notes": "熄火切黑"
        }
      ]
    }
  ],
  "seriesBible": {
    "version": "series-bible-v1",
    "canonCharacters": [
      "C01",
      "C02",
      "C03",
      "C04"
    ],
    "immutableRules": [
      "Karin、Rifa、Ras、Ref的面孔、身高比例、发型、服装基线与标志道具跨集不可重建",
      "Ras与Ref第一集不出镜，不得进入E01参考图请求",
      "任何新角色、服装、地点或道具必须先登记资产再进入镜头Prompt"
    ],
    "relationshipState": "互怼掩饰担忧 → 无言配合暴露力量 → Rifa 抓住 Karin → 两人的信任本身成为断剑识别 Karin 的媒介。",
    "worldRules": [
      "Mahadel保存诸界试图遗忘的记忆",
      "器物能够保存并借用接触者的记忆",
      "Karin十八岁后会使魔法装备逐渐失灵"
    ],
    "unresolvedThreads": [
      "谁曾带着同一把剑来过，木匣为什么记得 Karin？",
      "预言中缺失的两个名字是谁",
      "木匣为何记得Karin"
    ],
    "visualMotifs": [
      "CN3 悬疑逼近，雾蓝灰 → 暗紫红 → 短暂银白爆发 → 炉火琥珀 → 冷紫黑",
      "四点印记",
      "倒悬塔",
      "银色裂痕"
    ],
    "soundMotifs": [
      "无呼吸女声耳语",
      "低弦两音母题",
      "力量释放前的绝对静音"
    ]
  },
  "archive": {
    "formatVersion": "vozeb-drama-production-package-v1",
    "sections": [
      {
        "code": "SEC01",
        "title": "项目总览",
        "content": ""
      },
      {
        "code": "SEC02",
        "title": "原创第一章",
        "content": ""
      },
      {
        "code": "SEC03",
        "title": "第一集文学剧本（编剧链重构版）",
        "content": ""
      },
      {
        "code": "SEC04",
        "title": "镜头执行表",
        "content": ""
      },
      {
        "code": "SEC05",
        "title": "角色一致性资产",
        "content": ""
      },
      {
        "code": "SEC06",
        "title": "场景一致性资产",
        "content": ""
      },
      {
        "code": "SEC07",
        "title": "关键视频资产 Prompt",
        "content": ""
      },
      {
        "code": "SEC08",
        "title": "全案板 Prompt",
        "content": ""
      },
      {
        "code": "SEC09",
        "title": "台词与表演脚本",
        "content": ""
      },
      {
        "code": "SEC10",
        "title": "声音设计",
        "content": ""
      },
      {
        "code": "SEC11",
        "title": "Seedance 分段视频 Prompt",
        "content": ""
      },
      {
        "code": "SEC12",
        "title": "资产映射与执行顺序",
        "content": "\n\n生产方案快照（导入后作为本集执行契约）：\n{\n  \"version\": \"drama-production-plan-v1\",\n  \"skills\": [],\n  \"video\": {\n    \"model\": \"seedance-2-5\",\n    \"mode\": \"reference\",\n    \"ratio\": \"9:16\",\n    \"resolution\": \"720p\",\n    \"durationPolicy\": \"shot\",\n    \"count\": 1,\n    \"audioMode\": \"native\",\n    \"allowExplicitFallback\": false\n  },\n  \"references\": {\n    \"strategy\": \"adaptive\",\n    \"minImages\": 3,\n    \"maxImages\": 5,\n    \"roles\": [\n      \"previous_actual_tail\",\n      \"character_anchor\",\n      \"scene_anchor\",\n      \"prop_anchor\",\n      \"action_keyframe\",\n      \"composition_keyframe\"\n    ]\n  },\n  \"continuity\": {\n    \"mode\": \"strict\",\n    \"requireAcceptedActualTail\": true\n  },\n  \"source\": \"package\"\n}\n\n多帧执行规则：每镜按 framePlan.frames 的 Pxx-Fxx 时间顺序执行，并按 referenceManifest 的 @图片N 顺序提交 images；连续镜头的 @图片1 仅接受上一镜当前视频版本、已人工验收的实际尾帧。"
      },
      {
        "code": "SEC13",
        "title": "QC 报告",
        "content": ""
      }
    ],
    "promptAssets": [
      {
        "code": "V01",
        "category": "keyframe",
        "title": "首帧：黑湖倒塔",
        "prompt": "9:16竖屏电影关键帧，无文字无边框。黑色湖面贯穿画面，一座古老高塔倒悬在水下，塔尖指向湖面上Karin的模糊倒影；画面下方雪地里四只手彼此抓紧，只展示手和不可辨识轮廓，中央Karin掌心的完整剑刃正出现第一道裂口。深蓝黑、雪白、冷银，纵向压迫构图，远古记忆感，真实水面与皮肤材质。no text, no logo, no watermark, no border, no HUD, no identifiable extra faces, no broken hands, no extra fingers, no modern elements, no cartoon style, no flat illustration。",
        "shotCodes": [
          "SH01",
          "SH11"
        ]
      },
      {
        "code": "V02",
        "category": "keyframe",
        "title": "高潮帧：力量解封",
        "prompt": "9:16电影关键帧，无文字无边框。阿佐雷斯城门前，Karin与Rifa并肩克制站立，Karin深栗棕碎发、墨绿短斗篷、腰后断剑，Rifa黑色低侧辫、炭灰斗篷、暗红围巾；两人没有夸张施法动作，周围旗帜完全静止，尘埃悬在空中，透明皇家结界向他们形成浅凹，黄铜探测器同时出现细裂纹，检查官后退半步。银白无源光与深紫阴影，高压寂静感，人物面孔和服装精确，35mm广角，电影写实。no text, no logo, no watermark, no border, no HUD, no lightning bolts, no fire explosion, no extra limbs, no broken faces, no morphing。",
        "shotCodes": [
          "SH07"
        ]
      },
      {
        "code": "V03",
        "category": "keyframe",
        "title": "关系帧：街巷关心",
        "prompt": "9:16电影关键帧，无文字无边框。阿佐雷斯狭窄上坡街巷，Karin刚护住碰撞车沿的断剑，表情短暂脆弱，Rifa在半步外侧头看他，调侃已经收住，眼神担心；两人肩距很近但没有浪漫化肢体接触。背景为层叠石屋、吊桥与琥珀炉火反光，下午散射光，暖棕与雾蓝平衡，50mm中景，拟亲情式熟悉感。no text, no logo, no watermark, no border, no HUD, no romantic pose, no modern objects, no cartoon style。",
        "shotCodes": [
          "SH08"
        ]
      },
      {
        "code": "V04",
        "category": "keyframe",
        "title": "尾帧：四点木匣",
        "prompt": "9:16电影关键帧，无文字无边框。Edia Knight铸剑铺即将陷入黑暗，铁砧上的窄长木匣有一道银色裂痕与四个微亮圆点，Karin站在铁砧前，Rifa的手仍抓住他的手腕，奥伦位于后方暗处，烟黑铜镜里只映出高塔上的斗篷剪影。炉火最后一线琥珀光从左侧熄灭，冷紫黑阴影吞没空间，85mm缓慢逼近的终点构图，悬疑钩子。no text, no logo, no watermark, no border, no HUD, no excessive glow, no broken hands, no extra fingers, no modern workshop。",
        "shotCodes": [
          "SH12"
        ]
      },
      {
        "code": "SB01",
        "category": "storyboard",
        "title": "SH01-SH04",
        "prompt": "请生成一张9:16竖版电影级导演全案板，主题《Mahadel：四界之心》第一集《无灵压的旅人》，第1/3张，覆盖SH01-SH04。采用LS34竖屏短视频分镜板：顶部极简项目栏；上半部黑湖与倒悬塔主视觉；中部Karin、Rifa角色锚点；下半部自上而下四帧SH01黑湖记忆、SH02梦醒试探、SH03护符失灵、SH04穿过皇家结界；底部紧凑技术参数、CN3色彩与EC2情绪曲线。每镜标注11项参数与end_state。竖向构图突出倒塔、马车窗框和城门双塔，人物头顶与底部字幕留安全区。禁止横版内容压缩、文字遮脸、大段文字、随机logo、杂乱拼贴。clear panel separation, readable action, controlled annotations, no overloaded labels, no messy panels, no watermark, no garbled Chinese, no broken faces, no duplicated limbs, no flat illustration。",
        "shotCodes": [
          "SH01",
          "SH02",
          "SH03",
          "SH04"
        ]
      },
      {
        "code": "SB02",
        "category": "storyboard",
        "title": "SH05-SH08",
        "prompt": "请生成一张9:16竖版电影级导演全案板，主题《Mahadel：四界之心》第一集《无灵压的旅人》，第2/3张，覆盖SH05-SH08。采用LS34竖屏短视频分镜板：中央主视觉为SH07力量解封，Karin与Rifa位于中下部并肩，城门双塔向上延伸；四帧自上而下为SH05空白读数与封锁、SH06旧信号与选择、SH07解封与观察者、SH08坡城与“我问的是你”；侧边窄栏放角色锚点与完整参数。色彩暗蓝→暗紫→银白→石灰琥珀。禁止夸张雷电火焰、横向排队、人物换脸、现代检查站、过量粒子。clear panel separation, readable action, controlled annotations, no overloaded labels, no messy panels, no watermark, no garbled Chinese, no broken faces, no duplicated limbs, no flat illustration。",
        "shotCodes": [
          "SH05",
          "SH06",
          "SH07",
          "SH08"
        ]
      },
      {
        "code": "SB03",
        "category": "storyboard",
        "title": "SH09-SH12",
        "prompt": "请生成一张9:16竖版电影级导演全案板，主题《Mahadel：四界之心》第一集《无灵压的旅人》，第3/3张，覆盖SH09-SH12。采用LS34竖屏短视频分镜板：中央纵深主视觉为Edia Knight从门框、铁砧到炉膛的垂直空间；四帧自上而下为SH09银裂门牌与断剑震动、SH10奥伦试探断剑、SH11黑湖记忆显出暗红线、SH12四点木匣与铜镜观察者；侧边窄栏放Karin、Rifa、奥伦锚点与完整11项参数。色彩冷银→暗琥珀→深蓝黑→冷紫黑。禁止现代工坊、霓虹、文字遮挡手腕红线和木匣、横向拥挤、海报化。clear panel separation, readable action, controlled annotations, no overloaded labels, no messy panels, no watermark, no garbled Chinese, no broken faces, no duplicated limbs, no flat illustration。",
        "shotCodes": [
          "SH09",
          "SH10",
          "SH11",
          "SH12"
        ]
      }
    ],
    "dialogueDirections": [
      {
        "id": "D01",
        "shotCode": "SH01",
        "speaker": "记忆",
        "text": "你又来迟了。",
        "performance": "VL1耳语、SP2慢、无呼吸感",
        "lipSync": false
      },
      {
        "id": "D02",
        "shotCode": "SH02",
        "speaker": "Rifa",
        "text": "又是那个梦？",
        "performance": "VL2低声，先看呼吸再开口",
        "lipSync": true
      },
      {
        "id": "D03",
        "shotCode": "SH02",
        "speaker": "Karin",
        "text": "只是路太颠。",
        "performance": "VL3正常，回避视线",
        "lipSync": true
      },
      {
        "id": "D04",
        "shotCode": "SH02",
        "speaker": "Rifa",
        "text": "当然。石头还学会道歉了。",
        "performance": "VL3，干燥调侃，不追问",
        "lipSync": true
      },
      {
        "id": "D05",
        "shotCode": "SH03",
        "speaker": "Rifa",
        "text": "第几个？",
        "performance": "VL2，短句",
        "lipSync": true
      },
      {
        "id": "D06",
        "shotCode": "SH03",
        "speaker": "Karin",
        "text": "今天？",
        "performance": "VL3，拖延回答",
        "lipSync": true
      },
      {
        "id": "D07",
        "shotCode": "SH03",
        "speaker": "Rifa",
        "text": "十八岁以后。",
        "performance": "VL2，重音“十八岁”",
        "lipSync": true
      },
      {
        "id": "D08",
        "shotCode": "SH05",
        "speaker": "检查官",
        "text": "没有灵压，却带着Mahadel的徽记。",
        "performance": "VL3、SP2，逐字确认",
        "lipSync": true
      },
      {
        "id": "D09",
        "shotCode": "SH05",
        "speaker": "Rifa",
        "text": "你可以说我们很有礼貌。",
        "performance": "VL3，平静带刺",
        "lipSync": true
      },
      {
        "id": "D10",
        "shotCode": "SH05",
        "speaker": "检查官",
        "text": "也可以说，你们在隐藏危险。",
        "performance": "VL2、SP2，威胁",
        "lipSync": true
      },
      {
        "id": "D11",
        "shotCode": "SH05",
        "speaker": "Karin",
        "text": "我们只是来修一把剑。",
        "performance": "VL3，重音“一把剑”",
        "lipSync": true
      },
      {
        "id": "D12",
        "shotCode": "SH07",
        "speaker": "Karin",
        "text": "这样够明显吗？",
        "performance": "VL2，收力站稳后说",
        "lipSync": true
      },
      {
        "id": "D13",
        "shotCode": "SH07",
        "speaker": "观察者",
        "text": "两个异类。可预言里，缺了两个名字。",
        "performance": "VL1，句间SL1",
        "lipSync": false
      },
      {
        "id": "D14",
        "shotCode": "SH08",
        "speaker": "Rifa",
        "text": "还疼？",
        "performance": "VL2、SP2",
        "lipSync": true
      },
      {
        "id": "D15",
        "shotCode": "SH08",
        "speaker": "Karin",
        "text": "剑不会疼。",
        "performance": "VL3，避开视线",
        "lipSync": true
      },
      {
        "id": "D16",
        "shotCode": "SH08",
        "speaker": "Rifa",
        "text": "我问的是你。",
        "performance": "VL2、SP2，听者反应优先",
        "lipSync": true
      },
      {
        "id": "D17",
        "shotCode": "SH09",
        "speaker": "Rifa",
        "text": "你见过这个？",
        "performance": "VL2，观察Karin而非门牌",
        "lipSync": true
      },
      {
        "id": "D18",
        "shotCode": "SH09",
        "speaker": "Karin",
        "text": "没有。",
        "performance": "VL3，回答过快",
        "lipSync": true
      },
      {
        "id": "D19",
        "shotCode": "SH09",
        "speaker": "奥伦",
        "text": "关门。把剑放到铁砧上。",
        "performance": "VL2、SP2，命令平静",
        "lipSync": true
      },
      {
        "id": "D20",
        "shotCode": "SH10",
        "speaker": "奥伦",
        "text": "谁告诉你，它是被打断的？",
        "performance": "VL2，逻辑重音“被打断”",
        "lipSync": true
      },
      {
        "id": "D21",
        "shotCode": "SH10",
        "speaker": "Karin",
        "text": "我看着它断的。",
        "performance": "VL3，确定",
        "lipSync": true
      },
      {
        "id": "D22",
        "shotCode": "SH10",
        "speaker": "奥伦",
        "text": "你看见的是结果。",
        "performance": "VL2，句末停1秒",
        "lipSync": true
      },
      {
        "id": "D23",
        "shotCode": "SH11",
        "speaker": "奥伦",
        "text": "别放开。剑正在借她的记忆认你。",
        "performance": "VL2、SP2，重音“她的记忆”",
        "lipSync": true
      },
      {
        "id": "D24",
        "shotCode": "SH12",
        "speaker": "Rifa",
        "text": "你知道它为什么断？",
        "performance": "VL2，短促",
        "lipSync": true
      },
      {
        "id": "D25",
        "shotCode": "SH12",
        "speaker": "奥伦",
        "text": "它不是断了。它在拒绝保持完整。",
        "performance": "VL2、SP2，中间SL2",
        "lipSync": true
      },
      {
        "id": "D26",
        "shotCode": "SH12",
        "speaker": "奥伦",
        "text": "而你，不是第一个带它来这里的人。",
        "performance": "VL2、SP7渐慢",
        "lipSync": true
      },
      {
        "id": "D27",
        "shotCode": "SH12",
        "speaker": "Rifa",
        "text": "上一个人是谁？",
        "performance": "VL2，短刃出鞘后说",
        "lipSync": true
      },
      {
        "id": "D28",
        "shotCode": "SH12",
        "speaker": "记忆",
        "text": "你又来迟了。",
        "performance": "VL1，贴耳耳语",
        "lipSync": false
      }
    ],
    "voiceDirections": [
      {
        "subject": "Karin",
        "direction": "表面轻松、自我保护式幽默，语速中等；危险时反而更安静。"
      },
      {
        "subject": "Rifa",
        "direction": "短句、反应快，调侃里始终有保护欲；真正害怕时音量降低。"
      },
      {
        "subject": "检查官",
        "direction": "程序化、冷硬、吐字清楚。"
      },
      {
        "subject": "奥伦",
        "direction": "低沉缓慢，像每句话都在衡量代价。"
      },
      {
        "subject": "观察者/记忆",
        "direction": "耳语，近乎无呼吸感。"
      }
    ],
    "silenceDirections": [
      {
        "shotCode": "SH02",
        "direction": "问梦境后留SL1一秒，让Karin选择撒谎。"
      },
      {
        "shotCode": "SH03",
        "direction": "“十八岁以后”后留SL2两秒，不逼Karin解释。"
      },
      {
        "shotCode": "SH07",
        "direction": "解封前抽掉环境声三秒，力量表现为世界失常。"
      },
      {
        "shotCode": "SH08",
        "direction": "“我问的是你”后留SL2两秒，让沉默成为回答。"
      },
      {
        "shotCode": "SH10",
        "direction": "“你看见的是结果”后停一秒，再触剑。"
      },
      {
        "shotCode": "SH12",
        "direction": "“拒绝保持完整”后留SL2一秒半，再推出木匣。"
      }
    ],
    "referencePlan": [
      {
        "priority": 1,
        "asset": "C01 Karin角色卡",
        "purpose": "锁面孔、服装、断剑",
        "planType": "consistency_asset",
        "shotCodes": [
          "SH01",
          "SH02",
          "SH03",
          "SH04",
          "SH05",
          "SH06",
          "SH07",
          "SH08",
          "SH09",
          "SH10",
          "SH11",
          "SH12"
        ]
      },
      {
        "priority": 2,
        "asset": "C02 Rifa角色卡",
        "purpose": "锁面孔、服装、短刃",
        "planType": "consistency_asset",
        "shotCodes": [
          "SH02",
          "SH03",
          "SH04",
          "SH05",
          "SH06",
          "SH07",
          "SH08",
          "SH09",
          "SH10",
          "SH11",
          "SH12"
        ]
      },
      {
        "priority": 3,
        "asset": "S02 城门场景卡",
        "purpose": "锁城门空间与光向",
        "planType": "consistency_asset",
        "shotCodes": [
          "SH03",
          "SH04",
          "SH05",
          "SH06",
          "SH07"
        ]
      },
      {
        "priority": 4,
        "asset": "S03 城市场景卡",
        "purpose": "锁城市层级",
        "planType": "consistency_asset",
        "shotCodes": [
          "SH08"
        ]
      },
      {
        "priority": 5,
        "asset": "S04 铸剑铺场景卡",
        "purpose": "锁店内空间",
        "planType": "consistency_asset",
        "shotCodes": [
          "SH09",
          "SH10",
          "SH11",
          "SH12"
        ]
      },
      {
        "priority": 6,
        "asset": "V02 力量解封关键帧",
        "purpose": "锁高潮画面",
        "planType": "video_asset",
        "shotCodes": [
          "SH07"
        ]
      },
      {
        "priority": 7,
        "asset": "V03 街巷关系帧",
        "purpose": "锁情感距离",
        "planType": "video_asset",
        "shotCodes": [
          "SH08"
        ]
      },
      {
        "priority": 8,
        "asset": "V04 木匣尾帧",
        "purpose": "锁本集尾帧",
        "planType": "video_asset",
        "shotCodes": [
          "SH12"
        ]
      },
      {
        "priority": 9,
        "asset": "V01 黑湖倒塔首帧",
        "purpose": "锁开篇记忆母题",
        "planType": "video_asset",
        "shotCodes": [
          "SH01",
          "SH11"
        ]
      }
    ],
    "generationOrder": [
      "并行生成 C01、C02、S01-S04。",
      "依据角色卡与场景卡生成 V01-V04。",
      "检查人脸、服装、断剑、短刃、四点印记、空间与主光方向。",
      "按 P01-P12 分段生成视频，每段继承上一段 end_state。",
      "剪辑时使用声音桥连接P03→P04、P07→P08、P09→P10；P07的静音必须保留。"
    ],
    "qcReport": "## 十三、QC 报告\n\n### Prompt QC\n\n- 格式合同：通过。角色卡为 `consistency_asset`，场景卡为 `consistency_asset`，全案板为 `display_asset`，关键帧为 `video_asset`。\n- 语言：通过。默认中文，目标平台 Seedance 支持中文。\n- 画幅：通过。所有视觉资产与视频均为 9:16。\n- 负面词：通过。角色皮肤、奇幻时代、无文字视频资产与连续性负面词已覆盖。\n- 用途隔离：通过。全案板未进入视频引用；未生成资产不分配虚构编号。\n- 可复制性：通过。每条 Prompt 可独立复制执行。\n\n### 视频评分\n\n| 维度 | 分数 | 结论 |\n|---|---:|---|\n| 角色一致性 | 92 | Karin、Rifa均有5项不可变特征；每段重复核心DNA |\n| 场景一致性 | 91 | 四个主要场景均锁定空间、主光与固定元素 |\n| 动作可执行 | 94 | 每镜运动不超过相机/主体/环境各一种 |\n| 平台兼容 | 96 | 12段均为15秒；中文；单段Prompt低于1500字符目标 |\n| 连续性 | 93 | 每段有明确起止状态，P01/P11记忆母题闭合，P07/P12设关键锚点 |\n| Prompt格式 | 94 | 结构清楚，无虚构图片引用 |\n| 总分 | 93 | 通过 |\n\n### 最终视频 QC\n\n- 生成前静态检查12/12项通过：时长、角色、场景、动作、平台、连续性、格式、引用、模板、视觉干净度、视觉可用性、台词与声音覆盖。生成后的资产与成片仍需另行验收。\n- 待实际出图后复检：角色卡跨模块换脸、断剑护手形制、Rifa辫绳位置、Edia Knight铁砧/炉膛/铜镜位置、关键帧是否含伪文字。\n- 待实际视频后复检：P07静止效果是否被模型误解为卡帧，P11四手是否出现畸形或误锁角色脸，P12台词密度与所有口型是否同步。"
  }
}
```

## 项目总览



## 原创第一章



## 第一集文学剧本（编剧链重构版）



## 镜头执行表

| 镜号 | 时间 | 阶段 | 景别 | 运镜 | 焦段 | 灯光 | 色彩 | 转场 | 动作描述 | end_state |
|---|---:|---|---|---|---:|---|---|---|---|---|
| SH001 | 0-7.5s | B线钩子 | ELS→ECU | 垂直慢推 | 35mm | 无源冷光 | 深蓝黑+雪白 | 睁眼匹配切 | 黑湖、倒塔、四手与裂剑 | 黑湖、倒塔、四手与裂剑 |
| SH002 | 7.5-15s | B线钩子 | ELS→ECU | 垂直慢推 | 35mm | 无源冷光 | 深蓝黑+雪白 | 睁眼匹配切 | Karin在马车中惊醒，手扣断剑，呼吸急促 | Karin在马车中惊醒，手扣断剑，呼吸急促 |
| SH003 | 15-20s | 起/关系 | MS | 固定双人中景 | 50mm | 阴天柔光 | 雾蓝灰+皮革棕 | 水囊动作切 | Rifa识破梦境，Karin否认 | Rifa识破梦境，Karin否认；Rifa识破梦境，Karin否认 |
| SH004 | 20-25s | 起/关系 | MS | 固定双人中景 | 50mm | 阴天柔光 | 雾蓝灰+皮革棕 | 水囊动作切 | 梦醒试探的连续反应与动作过渡 | 梦醒试探的连续反应与动作过渡；梦醒试探的连续反应与动作过渡 |
| SH005 | 25-30s | 起/关系 | MS | 固定双人中景 | 50mm | 阴天柔光 | 雾蓝灰+皮革棕 | 水囊动作切 | Karin接住水囊，Rifa移开视线，关系恢复日常 | Karin接住水囊，Rifa移开视线，关系恢复日常；Karin接住水囊，Rifa移开视线，关系恢复日常 |
| SH006 | 30-37.5s | 起/异常 | MCU→LS | 车内慢拉 | 65mm | 柔光转结界冷光 | 暖棕→冷银 | 护符熄灭切 | 护符失灵，结界逼近 | 护符失灵，结界逼近；护符失灵，结界逼近 |
| SH007 | 37.5-45s | 起/异常 | MCU→LS | 车内慢拉 | 65mm | 柔光转结界冷光 | 暖棕→冷银 | 护符熄灭切 | Karin握住护符，Rifa望向结界，二人警觉 | Karin握住护符，Rifa望向结界，二人警觉；Karin握住护符，Rifa望向结界，二人警觉 |
| SH008 | 45-52.5s | 承/门槛 | LS→MCU | 前向跟车 | 35mm | 结界折射天光 | 冷银+暗蓝 | 指针匹配切 | 穿过结界，法师注视 | 穿过结界，法师注视；穿过结界，法师注视；穿过结界，法师注视 |
| SH009 | 52.5-60s | 承/门槛 | LS→MCU | 前向跟车 | 35mm | 结界折射天光 | 冷银+暗蓝 | 指针匹配切 | 二人站在检查台前，探测器举起 | 二人站在检查台前，探测器举起；二人站在检查台前，探测器举起；二人站在检查台前，探测器举起 |
| SH010 | 60-65s | 承/盘查 | OTS/MCU | 固定正反打 | 65mm | 城门侧光 | 冷灰+暗红 | 锁链硬切 | 空白读数与封锁 | 空白读数与封锁；空白读数与封锁；空白读数与封锁 |
| SH011 | 65-70s | 承/盘查 | OTS/MCU | 固定正反打 | 65mm | 城门侧光 | 冷灰+暗红 | 锁链硬切 | 空白读数的连续反应与动作过渡 | 空白读数的连续反应与动作过渡；空白读数的连续反应与动作过渡；空白读数的连续反应与动作过渡 |
| SH012 | 70-75s | 承/盘查 | OTS/MCU | 固定正反打 | 65mm | 城门侧光 | 冷灰+暗红 | 锁链硬切 | Karin前移半步，Rifa侧后，闸门锁闭 | Karin前移半步，Rifa侧后，闸门锁闭；Karin前移半步，Rifa侧后，闸门锁闭；Karin前移半步，Rifa侧后，闸门锁闭 |
| SH013 | 75-82.5s | 转/选择 | CU→MS | 缓慢推近 | 85mm | 冷暖分割 | 暗蓝→暗紫 | 拇指动作切 | 二人用旧信号决定解封 | 二人用旧信号决定解封；二人用旧信号决定解封 |
| SH014 | 82.5-90s | 转/选择 | CU→MS | 缓慢推近 | 85mm | 冷暖分割 | 暗蓝→暗紫 | 拇指动作切 | 两人完全并肩，封印将开未开 | 两人完全并肩，封印将开未开；两人完全并肩，封印将开未开 |
| SH015 | 90-95s | 转/爆发 | WS→MCU | 极慢环绕 | 35mm | 银白无源光 | 银白+深紫 | 声音骤停 | 世界短暂失去常态 | 世界短暂失去常态；世界短暂失去常态；世界短暂失去常态；世界短暂失去常态 |
| SH016 | 95-100s | 转/爆发 | WS→MCU | 极慢环绕 | 35mm | 银白无源光 | 银白+深紫 | 声音骤停 | 力量与观察的连续反应与动作过渡 | 力量与观察的连续反应与动作过渡；力量与观察的连续反应与动作过渡；力量与观察的连续反应与动作过渡；力量与观察的连续反应与动作过渡 |
| SH017 | 100-105s | 转/爆发 | WS→MCU | 极慢环绕 | 35mm | 银白无源光 | 银白+深紫 | 声音骤停 | 二人收力站稳，闸门打开，观察者远望 | 二人收力站稳，闸门打开，观察者远望；二人收力站稳，闸门打开，观察者远望；二人收力站稳，闸门打开，观察者远望；二人收力站稳，闸门打开，观察者远望 |
| SH018 | 105-110s | 转/余波 | ELS→MS | 吊臂下降 | 24mm | 散射光+炉火 | 石灰白+琥珀+灰蓝 | 碰剑声切 | 城市揭示与关系停顿 | 城市揭示与关系停顿；城市揭示与关系停顿 |
| SH019 | 110-115s | 转/余波 | ELS→MS | 吊臂下降 | 24mm | 散射光+炉火 | 石灰白+琥珀+灰蓝 | 碰剑声切 | 我问的是你的连续反应与动作过渡 | 我问的是你的连续反应与动作过渡；我问的是你的连续反应与动作过渡 |
| SH020 | 115-120s | 转/余波 | ELS→MS | 吊臂下降 | 24mm | 散射光+炉火 | 石灰白+琥珀+灰蓝 | 碰剑声切 | 二人并肩抵达上行坡道 | 二人并肩抵达上行坡道；二人并肩抵达上行坡道 |
| SH021 | 120-127.5s | 合/召唤 | CU→LS | 银裂纹后拉 | 65mm | 银纹冷光+炉光 | 冷银+暗琥珀 | 门开切内景 | 裂纹似梦中断口 | 裂纹似梦中断口；裂纹似梦中断口；裂纹似梦中断口 |
| SH022 | 127.5-135s | 合/召唤 | CU→LS | 银裂纹后拉 | 65mm | 银纹冷光+炉光 | 冷银+暗琥珀 | 门开切内景 | 二人立在门槛，奥伦背对，Karin隐瞒梦境 | 二人立在门槛，奥伦背对，Karin隐瞒梦境；二人立在门槛，奥伦背对，Karin隐瞒梦境；二人立在门槛，奥伦背对，Karin隐瞒梦境 |
| SH023 | 135-140s | 合/试探 | MCU | 侧向滑轨 | 50mm | 炉火侧光 | 煤黑+琥珀 | 锤柄触剑切 | 奥伦质疑“被打断” | 奥伦质疑“被打断”；奥伦质疑“被打断”；奥伦质疑“被打断” |
| SH024 | 140-145s | 合/试探 | MCU | 侧向滑轨 | 50mm | 炉火侧光 | 煤黑+琥珀 | 锤柄触剑切 | 你看见的是结果的连续反应与动作过渡 | 你看见的是结果的连续反应与动作过渡；你看见的是结果的连续反应与动作过渡；你看见的是结果的连续反应与动作过渡 |
| SH025 | 145-150s | 合/试探 | MCU | 侧向滑轨 | 50mm | 炉火侧光 | 煤黑+琥珀 | 锤柄触剑切 | 断剑平放铁砧，锤柄抵住断口 | 断剑平放铁砧，锤柄抵住断口；断剑平放铁砧，锤柄抵住断口；断剑平放铁砧，锤柄抵住断口 |
| SH026 | 150-155s | 双线汇合 | CU→ECU | 记忆慢推 | 85mm | 炉火收缩+冷光 | 琥珀→深蓝黑 | 抓腕切回 | 记忆显出暗红线 | 记忆显出暗红线；记忆显出暗红线；记忆显出暗红线 |
| SH027 | 155-160s | 双线汇合 | CU→ECU | 记忆慢推 | 85mm | 炉火收缩+冷光 | 琥珀→深蓝黑 | 抓腕切回 | 借她的记忆的连续反应与动作过渡 | 借她的记忆的连续反应与动作过渡；借她的记忆的连续反应与动作过渡；借她的记忆的连续反应与动作过渡 |
| SH028 | 160-165s | 双线汇合 | CU→ECU | 记忆慢推 | 85mm | 炉火收缩+冷光 | 琥珀→深蓝黑 | 抓腕切回 | Rifa抓住Karin，奥伦注视相接的手 | Rifa抓住Karin，奥伦注视相接的手；Rifa抓住Karin，奥伦注视相接的手；Rifa抓住Karin，奥伦注视相接的手 |
| SH029 | 165-172.5s | 悬念钩子 | MCU→ECU | 木匣慢推 | 85mm | 炉火熄灭 | 暗琥珀→冷紫黑 | 熄火切黑 | 答案与新问题 | 答案与新问题；答案与新问题；答案与新问题；答案与新问题 |
| SH030 | 172.5-180s | 悬念钩子 | MCU→ECU | 木匣慢推 | 85mm | 炉火熄灭 | 暗琥珀→冷紫黑 | 熄火切黑 | 木匣四点微亮，铜镜现观察者，短刃出鞘半寸 | 木匣四点微亮，铜镜现观察者，短刃出鞘半寸；木匣四点微亮，铜镜现观察者，短刃出鞘半寸；木匣四点微亮，铜镜现观察者，短刃出鞘半寸；木匣四点微亮，铜镜现观察者，短刃出鞘半寸 |

## 角色一致性资产



## 场景一致性资产



## 关键视频资产 Prompt



## 全案板 Prompt



## 台词与表演脚本



## 声音设计



## Seedance 分段视频 Prompt



## 资产映射与执行顺序



生产方案快照（导入后作为本集执行契约）：
{
  "version": "drama-production-plan-v1",
  "skills": [],
  "video": {
    "model": "seedance-2-5",
    "mode": "reference",
    "ratio": "9:16",
    "resolution": "720p",
    "durationPolicy": "shot",
    "count": 1,
    "audioMode": "native",
    "allowExplicitFallback": false
  },
  "references": {
    "strategy": "adaptive",
    "minImages": 3,
    "maxImages": 5,
    "roles": [
      "previous_actual_tail",
      "character_anchor",
      "scene_anchor",
      "prop_anchor",
      "action_keyframe",
      "composition_keyframe"
    ]
  },
  "continuity": {
    "mode": "strict",
    "requireAcceptedActualTail": true
  },
  "source": "package"
}

多帧执行规则：每镜按 framePlan.frames 的 Pxx-Fxx 时间顺序执行，并按 referenceManifest 的 @图片N 顺序提交 images；连续镜头的 @图片1 仅接受上一镜当前视频版本、已人工验收的实际尾帧。

## QC 报告
