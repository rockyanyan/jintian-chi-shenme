#!/usr/bin/env bash
# ============================================================
# 今天吃什么 —— 一键打包 APK
# 依赖（脚本会按下面的路径查找，可用环境变量覆盖）：
#   ANDROID_BUILD_TOOLS : Android build-tools 34+（含 aapt2/d8/zipalign/apksigner）
#   ANDROID_PLATFORM_JAR: platforms/android-3x/android.jar
#   JDK17               : JDK 11+（d8 需要），用于 javac / keytool
# 用法:  bash scripts/build-apk.sh
# ============================================================
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS="${TOOLS:-/e/jtcse-build}"
BT="${ANDROID_BUILD_TOOLS:-$TOOLS/sdk/android-14}"
AJ="${ANDROID_PLATFORM_JAR:-$TOOLS/sdk/android-35/android.jar}"
JDK="${JDK17:-$TOOLS/jdk17tmp/jdk-17.0.20.1+1}"

# 工作目录必须是纯英文路径（aapt2 不支持中文路径）
WORK="${BUILD_WORK:-$TOOLS/build-work}"
VERSION_NAME="1.0"
VERSION_CODE=1
KS="$WORK/android/release.keystore"
KS_PASS="jintian2026"

echo "==> 1/6 准备工作目录"
rm -rf "$WORK"; mkdir -p "$WORK/out" "$WORK/gen" "$WORK/classes" "$WORK/dex" "$WORK/assets"
cp -r "$ROOT/app/." "$WORK/assets/"
cp -r "$ROOT/android" "$WORK/android"

echo "==> 2/6 aapt2 编译 + 链接资源"
"$BT/aapt2.exe" compile --dir "$WORK/android/res" -o "$WORK/res.zip"
"$BT/aapt2.exe" link -o "$WORK/out/base.apk" -I "$AJ" \
  --manifest "$WORK/android/AndroidManifest.xml" -A "$WORK/assets" \
  --java "$WORK/gen" --min-sdk-version 21 --target-sdk-version 35 \
  --version-code $VERSION_CODE --version-name "$VERSION_NAME" --auto-add-overlay "$WORK/res.zip"

echo "==> 3/6 javac 编译 Java"
"$JDK/bin/javac" -encoding UTF-8 -source 1.8 -target 1.8 \
  -bootclasspath "$AJ" -d "$WORK/classes" \
  "$WORK/gen/com/jintianchi/shenme/R.java" \
  "$WORK/android/src/com/jintianchi/shenme/MainActivity.java"

echo "==> 4/6 d8 转 dex"
( cd "$WORK" && JAVA_HOME="$JDK" PATH="$JDK/bin:$PATH" \
  cmd //c "$(cygpath -w "$BT")\\d8.bat --release --lib $(cygpath -w "$AJ") \
  --min-api 21 --output dex classes\\com\\jintianchi\\shenme\\*.class" )

echo "==> 5/6 合并 dex、修正资源路径、zipalign"
python - "$WORK" <<'PYEOF'
import zipfile, sys
work = sys.argv[1]
zin = zipfile.ZipFile(work + "/out/base.apk")
zout = zipfile.ZipFile(work + "/out/unsigned.apk", "w", zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    zout.writestr(item.filename.replace("\\", "/"), zin.read(item.filename))
zout.write(work + "/dex/classes.dex", "classes.dex")
zout.close(); zin.close()
print("merged")
PYEOF
"$BT/zipalign.exe" -f -p 4 "$WORK/out/unsigned.apk" "$WORK/out/aligned.apk"

echo "==> 6/6 apksigner 签名"
mkdir -p "$ROOT/dist"
"$JDK/bin/keytool" -genkeypair -keystore "$KS" -alias jintian -keyalg RSA -keysize 2048 \
  -validity 10950 -storepass $KS_PASS -keypass $KS_PASS \
  -dname "CN=JinTianChiShenMe, OU=App, O=Jintian, C=CN" 2>/dev/null || true
JAVA_HOME="$JDK" PATH="$JDK/bin:$PATH" \
  "$BT/apksigner.bat" sign --ks "$KS" --ks-pass pass:$KS_PASS --key-pass pass:$KS_PASS \
  --out "$ROOT/dist/今天吃什么.apk" "$WORK/out/aligned.apk"
JAVA_HOME="$JDK" PATH="$JDK/bin:$PATH" "$BT/apksigner.bat" verify "$ROOT/dist/今天吃什么.apk"

echo ""
echo "✅ 打包完成: $ROOT/dist/今天吃什么.apk"
