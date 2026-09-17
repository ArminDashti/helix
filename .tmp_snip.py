from pathlib import Path
p = Path(r"C:\Users\armin\GitHub\helix\helix-api\backend\api\config_loader.py")
lines = p.read_text(encoding="utf-8").splitlines()
for i, line in enumerate(lines):
    if line.startswith("def get_agent_model"):
        print("\n".join(f"{i+1}:{l}" for l in lines[i : i + 25]))
        break
