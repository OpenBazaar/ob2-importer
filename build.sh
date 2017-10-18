#!/bin/sh

## Version 1.0
##
## Usage
## ./build.sh
##
## OS supported:
## win32 win64 linux32 linux64 linuxarm osx
##

ELECTRONVER=1.7.8
NODEJSVER=5.1.1

OS="${1}"

# Get Version
PACKAGE_VERSION=$(cat package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')
echo "OpenBazaar 2 Importer Version: $PACKAGE_VERSION"

# Create temp/build dirs
mkdir build/
rm -rf build/*
mkdir temp/
rm -rf temp/*

echo 'Preparing to build installers...'

echo 'Installing npm packages...'
npm install electron-packager -g --save-dev --silent
npm install npm-run-all -g --save-dev --silent
npm install grunt-cli -g --save-dev --silent
npm install grunt --save-dev --silent
npm install grunt-electron-installer --save-dev --silent
npm install --silent
#
# echo 'Building OpenBazaar 2 Importer app...'
# npm run build
#
# echo 'Copying transpiled files into js folder...'
# cp -rf prod/* js/

case "$TRAVIS_OS_NAME" in
  "linux")

    echo 'Linux builds'

    echo 'Building Linux 32-bit Installer....'

    echo 'Making build directories'
    mkdir build/linux32
    mkdir build/linux64

    echo 'Install npm packages for Linux'
    npm install -g --save-dev electron-installer-debian --silent
    npm install -g --save-dev electron-installer-redhat --silent

    cd dist/ob2importer
    npm install
    cd ../..

    # Install rpmbuild
    sudo apt-get install rpm

    # Ensure fakeroot is installed
    sudo apt-get install fakeroot

    APPNAME="openbazaar2importer"

    echo "Packaging Electron application"
    electron-packager dist/ob2importer ${APPNAME} --platform=linux --arch=ia32 --version=${ELECTRONVER} --overwrite --prune --out=build

    echo 'Create debian archive'
    electron-installer-debian --config .travis/config_ia32.json

    echo 'Create RPM archive'
    electron-installer-redhat --config .travis/config_ia32.json

    echo 'Building Linux 64-bit Installer....'

    echo "Packaging Electron application"
    electron-packager dist/ob2importer ${APPNAME} --platform=linux --arch=x64 --version=${ELECTRONVER} --overwrite --prune --out=build

    echo 'Create debian archive'
    electron-installer-debian --config .travis/config_amd64.json

    echo 'Create RPM archive'
    electron-installer-redhat --config .travis/config_amd64.json

    ;;

  "osx")

    brew update
    brew install jq
    curl -L https://dl.bintray.com/develar/bin/7za -o /tmp/7za
    chmod +x /tmp/7za
    curl -L https://dl.bintray.com/develar/bin/wine.7z -o /tmp/wine.7z
    /tmp/7za x -o/usr/local/Cellar -y /tmp/wine.7z

    brew link --overwrite fontconfig gd gnutls jasper libgphoto2 libicns libtasn1 libusb libusb-compat little-cms2 nettle openssl sane-backends webp wine git-lfs gnu-tar dpkg xz
    brew install freetype graphicsmagick
    brew link xz
    brew install mono

    # WINDOWS 32
    echo 'Building Windows 32-bit Installer...'
    mkdir build/win32

    echo 'Running Electron Packager...'
    electron-packager ./dist/ob2importer OpenBazaar2Importer --out=build --protocol-name=OpenBazaar --win32metadata.ProductName="OpenBazaar2Importer" --win32metadata.CompanyName="OpenBazaar" --win32metadata.FileDescription='Import tool for OpenBazaar 2' --win32metadata.OriginalFilename=OpenBazaar2Importer.exe --protocol=ob --platform=win32 --arch=ia32 --icon=imgs/openbazaar2.ico --electron-version=${ELECTRONVER} --overwrite

    echo 'Building Installer...'
    grunt create-windows-installer --obversion=$PACKAGE_VERSION --appdir=build/OpenBazaar2Importer-win32-ia32 --outdir=build/win32
    mv build/win32/OpenBazaar2ImporterSetup.exe build/win32/OpenBazaar2Importer-$PACKAGE_VERSION-Setup-32.exe
    mv build/win64/RELEASES build/win32/RELEASES
    #
    # echo 'Sign the installer'
    # signcode -t http://timestamp.digicert.com -a sha1 -spc .travis/ob1.cert.spc -pvk .travis/ob1.pvk -n "OpenBazaar $PACKAGE_VERSION" build/win32/OpenBazaar2-$PACKAGE_VERSION-Setup-32.exe


    # # WINDOWS 64
    # echo 'Building Windows 64-bit Installer...'
    # mkdir build/win64
    #
    # echo 'Running Electron Packager...'
    # electron-packager . OpenBazaar2 --asar=true --out=build --protocol-name=OpenBazaar --win32metadata.ProductName="OpenBazaar2" --win32metadata.CompanyName="OpenBazaar" --win32metadata.FileDescription='Decentralized p2p marketplace for Bitcoin' --win32metadata.OriginalFilename=OpenBazaar2.exe --protocol=ob --platform=win32 --arch=x64 --icon=imgs/openbazaar2.ico --=${ELECTRONVER} --overwrite
    #
    # echo 'Copying server binary into application folder...'
    # cp -rf temp/openbazaar-go-windows-4.0-amd64.exe build/OpenBazaar2-win32-x64/resources/
    #
    # echo 'Copying server binary into application folder...'
    # cp -rf temp/openbazaar-go-windows-4.0-amd64.exe build/OpenBazaar2-win32-x64/resources/
    # cp -rf temp/libwinpthread-1.win64.dll build/OpenBazaar2-win32-x64/resources/libwinpthread-1.dll
    # mkdir build/OpenBazaar2-win32-x64/resources/openbazaar-go
    # mv build/OpenBazaar2-win32-x64/resources/openbazaar-go-windows-4.0-amd64.exe build/OpenBazaar2-win32-x64/resources/openbazaar-go/openbazaard.exe
    # mv build/OpenBazaar2-win32-x64/resources/libwinpthread-1.dll build/OpenBazaar2-win32-x64/resources/openbazaar-go/libwinpthread-1.dll
    #
    # echo 'Building Installer...'
    # grunt create-windows-installer --obversion=$PACKAGE_VERSION --appdir=build/OpenBazaar2-win32-x64 --outdir=build/win64
    # mv build/win64/OpenBazaar2Setup.exe build/win64/OpenBazaar2-$PACKAGE_VERSION-Setup-64.exe
    # mv build/win64/RELEASES build/win64/RELEASES-x64
    #
    # echo 'Sign the installer'
    # signcode -t http://timestamp.digicert.com -a sha1 -spc .travis/ob1.cert.spc -pvk .travis/ob1.pvk -n "OpenBazaar $PACKAGE_VERSION" build/win64/OpenBazaar2-$PACKAGE_VERSION-Setup-64.exe
    #

    # OSX
    echo 'Building OSX Installer'
    mkdir build/osx

    # Install the DMG packager
    echo 'Installing electron-installer-dmg'
    npm install -g electron-installer-dmg

    echo 'Running Electron Packager...'
    electron-packager ./dist/ob2importer OpenBazaar2Importer --out=build -app-category-type=public.app-category.business --platform=darwin --arch=x64 --icon=imgs/openbazaar2.icns --electron-version=${ELECTRONVER} --overwrite --app-version=$PACKAGE_VERSION

    # echo 'Codesign the .app'
    # codesign --force --deep --sign "$SIGNING_IDENTITY" build/OpenBazaar2-darwin-x64/OpenBazaar2.app
    electron-installer-dmg build/OpenBazaar2Importer-darwin-x64/OpenBazaar2Importer.app OpenBazaar2Importer-$PACKAGE_VERSION --icon ./imgs/openbazaar2.icns --out=build/OpenBazaar2Importer-darwin-x64 --overwrite --background=./imgs/osx-finder_background.png --debug
    #
    # echo 'Codesign the DMG and zip'
    # codesign --force --sign "$SIGNING_IDENTITY" build/OpenBazaar2-darwin-x64/OpenBazaar2-$PACKAGE_VERSION.dmg
    cd build/OpenBazaar2Importer-darwin-x64/

    zip -q -r OpenBazaar2Importer-mac-$PACKAGE_VERSION.zip OpenBazaar2Importer.app

    cp -r OpenBazaar2Importer.app ../osx/
    cp OpenBazaar2Importer-mac-$PACKAGE_VERSION.zip ../osx/
    cp OpenBazaar2Importer-$PACKAGE_VERSION.dmg ../osx/


    ;;
esac
