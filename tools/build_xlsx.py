#!/usr/bin/env python3
"""Build TimeTrainer_Cheatsheets.xlsx (one sheet per mode) from the data JSON files.

    python3 tools/build_xlsx.py
"""
import json, os
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = {m: json.load(open(os.path.join(ROOT, "data", m + ".json"), encoding="utf-8"))
     for m in ["cars", "outfits", "languages", "plates", "logos", "landmarks", "countries", "clues", "photos", "military", "general"]}

HEAD = PatternFill("solid", fgColor="E8A33D")
TITLE = Font(bold=True, size=14)
BOLD = Font(bold=True)
WRAP = Alignment(wrap_text=True, vertical="top")


def add_sheet(wb, name, about, tables, widths):
    ws = wb.create_sheet(name)
    r = 1
    ws.cell(r, 1, name).font = TITLE
    r += 1
    if about:
        ws.cell(r, 1, about).alignment = Alignment(wrap_text=False)
        r += 2
    for title, cols, rows in tables:
        ws.cell(r, 1, title).font = Font(bold=True, size=12)
        r += 1
        for c, h in enumerate(cols, 1):
            cell = ws.cell(r, c, h)
            cell.font = BOLD
            cell.fill = HEAD
        if ws.freeze_panes is None:
            ws.freeze_panes = ws.cell(r + 1, 1)
        r += 1
        for row in rows:
            for c, v in enumerate(row, 1):
                ws.cell(r, c, v).alignment = WRAP
            r += 1
        r += 1
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w


def main():
    wb = Workbook()
    wb.remove(wb.active)
    g, c, o, l, p, lg = D["general"], D["cars"], D["outfits"], D["languages"], D["plates"], D["logos"]
    add_sheet(wb, "Era tells", g["about"], [
        ("Era tells", ["Category", "Clue", "Period"], g["sheet"]),
        ("Baseline strategy", ["#", "Tip"], [[i + 1, t] for i, t in enumerate(g["baseline_tips"])]),
        ("Dating clues from brands & objects", ["Clue", "Year", "Note"], lg["sheet_extra"]),
    ], [16, 80, 30])
    add_sheet(wb, "Cars", c["about"], [
        ("Car shapes by era", ["Era", "What to look for", "Typical models"], c["sheet"]),
        ("Model list", ["Model", "From", "To", "Region", "Tell"],
         [[x["n"], x["f"], x["t"] if x["t"] else "today", x["r"], x["tell"]] for x in sorted(c["items"], key=lambda x: x["f"])]),
    ], [32, 70, 45, 8, 60])
    add_sheet(wb, "Outfits", o["about"], [("Fashion by decade", ["Decade", "Women", "Men", "Quick tell"], o["sheet"])], [10, 60, 60, 40])
    add_sheet(wb, "Languages", l["about"], [("Languages & scripts", ["Language", "Script", "Unique letters", "Giveaway words", "Don't confuse with"],
                                            [[x["n"], x["script"], x["uniq"], x["words"], x["vs"]] for x in l["items"]])], [24, 20, 32, 50, 60])
    add_sheet(wb, "Plates", p["about"], [("License plates", ["Country", "Region", "Current format", "Tells & history"],
                                         [[x["c"], x["g"], x["now"], x["tell"]] for x in p["items"]])], [18, 18, 40, 90])
    add_sheet(wb, "Logos", lg["about"], [
        ("Logo changes", ["Brand", "Year", "Change"], [[b["b"], y, t] for b in lg["brands"] for y, t in b["timeline"]]),
        ("Other dating clues", ["Clue", "Year", "Note"], lg["sheet_extra"]),
    ], [26, 8, 90])
    lm = D["landmarks"]
    add_sheet(wb, "Landmarks", lm["about"], [
        ("Landmarks: not before…", ["Landmark", "City", "Region", "Completed", "Gone", "Tell"],
         [[x["n"], x["city"], x["g"], x["y"], x.get("gone") or "", x["tell"]] for x in sorted(lm["items"], key=lambda x: (lm["regions"].index(x["g"]), x["y"]))]),
    ], [34, 20, 20, 11, 8, 80])
    cl = D["clues"]
    add_sheet(wb, "Clues", cl["about"], [
        ("Not before… (and gone after)", ["Clue", "Category", "From", "Until"],
         [[x["c"], x["cat"], x["f"], x.get("t") or ""] for x in sorted(cl["items"], key=lambda x: x["f"])]),
    ], [55, 18, 8, 8])
    ph = D["photos"]
    add_sheet(wb, "Photo era", ph["about"], [
        ("The look of each decade", ["Decade", "Look"], [[f'{d["f"]}s', d["look"]] for d in ph["decades"]]),
    ], [10, 100])
    mi = D["military"]
    add_sheet(wb, "Military", mi["about"], [
        ("Uniforms & helmets", ["Name", "Kind", "Army", "From", "To", "Tell"],
         [[x["n"], x["k"], x["army"], x["f"], x["t"] or "today", x["tell"]] for x in sorted(mi["items"], key=lambda x: (mi["kinds"].index(x["k"]), x["f"]))]),
    ], [30, 12, 30, 7, 7, 70])
    plate_g = {x["c"]: x["g"] for x in p["items"]}
    co = D["countries"]
    add_sheet(wb, "Countries", co["about"], [
        ("Country tells", ["Country", "Region", "Drives", "Currency", "Web", "Tell"],
         [[x["c"], plate_g.get(x["c"], ""), x["d"], x["cur"], x["tld"], x["x"]] for x in co["items"]]),
    ], [18, 18, 22, 50, 22, 60])
    out = os.path.join(ROOT, "TimeTrainer_Cheatsheets.xlsx")
    wb.save(out)
    print("wrote", out)


if __name__ == "__main__":
    main()
