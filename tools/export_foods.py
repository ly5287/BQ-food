# -*- coding: utf-8 -*-
"""从 食物.xlsx 导出 foods.js。

用法：python tools/export_foods.py
- 读取桌面 食物.xlsx 的 主食类/菜品类/饮料/甜点/零食小吃/黑暗料理 六个 sheet
- 前四列固定为 大类 / 中类 / 小类 / 名称（大类只在该类首行出现，需剥离）
- 表头里以「剧情」开头的列（剧情1、剧情2…）全部收进 desc 数组；
  每段第一行按「出处 / 标注」处理，其余为正文
- 没有剧情的条目 desc 为空数组，页面自动显示占位文案
"""
import json
import os

import openpyxl

SRC = r'C:/Users/Administrator/Desktop/食物.xlsx'
SHEETS = ['主食类', '菜品类', '饮料', '甜点', '零食小吃', '黑暗料理']
# 每个 sheet 对应的「大类」文字，只出现在该 sheet 首行，需要剥掉
BIG = {'主食类': '主食', '菜品类': '菜品', '饮料': '饮料', '甜点': '甜点',
       '零食小吃': '零食小吃', '黑暗料理': '黑暗料理'}

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'foods.js')


def norm(v):
    return '' if v is None else str(v).replace('\r\n', '\n').replace('\r', '\n').strip()


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True)
    lines = []
    total = 0
    with_scene = 0

    for name in SHEETS:
        ws = wb[name]
        head = [norm(c) for c in next(ws.iter_rows(values_only=True))]
        scene_cols = [i for i, h in enumerate(head) if h.startswith('剧情')]
        items, seen = [], set()

        for row in ws.iter_rows(min_row=2, values_only=True):
            cells = [norm(c) for c in row]
            base = [c for c in cells[:4] if c]
            if not base:
                continue
            if base[0] == BIG.get(name, ''):
                base = base[1:]
            food = base[-1]
            rest = base[:-1]
            if not food or food in seen:
                continue
            seen.add(food)
            mid = rest[0] if len(rest) >= 1 else ''
            sub = rest[1] if len(rest) >= 2 else ''
            scenes = [cells[i] for i in scene_cols if i < len(cells) and cells[i]]
            if scenes:
                with_scene += 1
            items.append((food, mid, sub, scenes))

        lines.append('  "%s": [' % name)
        for food, mid, sub, scenes in items:
            j = lambda s: json.dumps(s, ensure_ascii=False)
            if scenes:
                body = ',\n'.join('      ' + j(s) for s in scenes)
                lines.append('    {"name": %s, "mid": %s, "sub": %s, "desc": [\n%s\n    ]},'
                             % (j(food), j(mid), j(sub), body))
            else:
                lines.append('    {"name": %s, "mid": %s, "sub": %s, "desc": []},'
                             % (j(food), j(mid), j(sub)))
        lines.append('  ],')
        print(name, len(items), '有剧情', sum(1 for i in items if i[3]))
        total += len(items)

    if lines:
        lines[-1] = lines[-1].rstrip(',')
    js = ('// 食物选项数据（本地维护）\n'
          '// { name: 名称, mid: 中类, sub: 小类, desc: [剧情1, 剧情2, ...] }\n'
          '// desc 为空数组时页面显示占位文案；改完保存，刷新页面生效。\n'
          'window.FOOD_DATA = {\n' + '\n'.join(lines) + '\n};\n')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(js)
    print('total', total, '有剧情条目', with_scene)


if __name__ == '__main__':
    main()
