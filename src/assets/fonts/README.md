# 字体子集

`NotoSansSC-Bold-og-subset.otf` 是 Noto Sans CJK SC Bold（SIL Open Font License 1.1）的子集，
只包含默认分享图（`src/app/opengraph-image.tsx`）里用到的字，用来让 next/og 正确显示中文，
又不会把十几 MB 的完整字体打进函数包。

修改分享图文字后重新生成（需要 Python fonttools）：

```bash
python3 - <<'PY'
from fontTools.ttLib import TTCollection
from fontTools import subset
text = "<分享图里出现的所有文字>"
f = TTCollection('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc').fonts[2]  # index 2 = SC
o = subset.Options(); o.layout_features = ['*']; o.name_IDs = ['*']
s = subset.Subsetter(o); s.populate(text=text); s.subset(f)
f.save('src/assets/fonts/NotoSansSC-Bold-og-subset.otf')
PY
```
