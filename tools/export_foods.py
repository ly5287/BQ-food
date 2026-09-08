# -*- coding: utf-8 -*-
"""从 食物.xlsx 导出 foods.js。

用法：python tools/export_foods.py
- 读取桌面 食物.xlsx 的 主食类/菜品类/饮料/甜点/零食小吃 五个 sheet
- 输出 foods.js，每项一行，便于手工增删：{"name":"名称","sub":"小类","desc":"介绍"}
- 后续食物介绍文案在表格里备好后，把表格路径填到 DESC_XLSX 即可自动带入 desc
"""
import os
import openpyxl

SRC = r'C:/Users/Administrator/Desktop/食物.xlsx'
DESC_XLSX = ''            # 例如 r'C:/Users/Administrator/Desktop/食物介绍.xlsx'
SHEETS = ['主食类', '菜品类', '饮料', '甜点', '零食小吃']
# 每个 sheet 对应的「大类」文字，只出现在该 sheet 首行，需要剥掉
BIG = {'主食类': '主食', '菜品类': '菜品', '饮料': '饮料', '甜点': '甜点', '零食小吃': '零食小吃'}

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'foods.js')


def load_desc():
    """返回 {食物名: 介绍}；未配置 DESC_XLSX 时返回空字典"""
    if not DESC_XLSX or not os.path.exists(DESC_XLSX):
        return {}
    wb = openpyxl.load_workbook(DESC_XLSX, data_only=True)
    ws = wb.worksheets[0]
    out = {}
    for row in ws.iter_rows(values_only=True):
        vals = [str(v).strip() for v in row if v is not None and str(v).strip()]
        if len(vals) >= 2:
            out[vals[0]] = vals[1]
    return out


def main():
    desc_map = load_desc()
    wb = openpyxl.load_workbook(SRC, data_only=True)
    lines = []
    total = 0
    for name in SHEETS:
        ws = wb[name]
        items, seen = [], set()
        for row in ws.iter_rows(values_only=True):
            vals = [str(v).strip() for v in row if v is not None and str(v).strip()]
            if not vals:
                continue
            if vals[-1] == '名称':          # 表头行
                continue
            food = vals[-1]
            rest = vals[:-1]
            if rest and rest[0] == BIG.get(name, ''):   # 去掉大类列
                rest = rest[1:]
            mid = rest[0] if len(rest) >= 1 else ''     # 中类（B列），如 煮制类 / 烤制类 / 酒
            sub = rest[1] if len(rest) >= 2 else ''     # 小类（C列），如 面条 / 中式烤制 / 啤酒
            if not food or food in seen:
                continue
            seen.add(food)
            items.append((food, mid, sub))
        lines.append('  "%s": [' % name)
        for food, mid, sub in items:
            d = desc_map.get(food, '')
            lines.append('    {"name": "%s", "mid": "%s", "sub": "%s", "desc": "%s"},'
                         % (food, mid, sub, d.replace('"', '\\"')))
        lines.append('  ],')
        print(name, len(items))
        total += len(items)
    if lines:
        lines[-1] = lines[-1].rstrip(',')
    js = ('// 食物选项数据（本地维护）\n'
          '// 每行一项，直接增删即可：{ name: 名称, sub: 小类（可留空）, desc: 弹窗介绍（可留空） }\n'
          '// 改完保存，刷新页面生效。\n'
          'window.FOOD_DATA = {\n' + '\n'.join(lines) + '\n};\n')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(js)
    print('total', total)


if __name__ == '__main__':
    main()
