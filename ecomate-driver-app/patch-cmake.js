const fs = require('fs');
const path = require('path');

const cmakePatch = [
  '',
  '# PATCHED_CPP_SHARED',
  'find_library(LIB_CPP_SHARED c++_shared)',
  'if(LIB_CPP_SHARED)',
  '  get_property(ALL_TARGETS DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR} PROPERTY BUILDSYSTEM_TARGETS)',
  '  foreach(T ${ALL_TARGETS})',
  '    get_target_property(T_TYPE ${T} TYPE)',
  '    if(T_TYPE STREQUAL "SHARED_LIBRARY")',
  '      target_link_libraries(${T} ${LIB_CPP_SHARED})',
  '    endif()',
  '  endforeach()',
  'endif()',
  '',
].join('\n');

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('PATCHED_CPP_SHARED')) {
    console.log('Already patched: ' + filePath);
    return false;
  }
  fs.writeFileSync(filePath, content + cmakePatch);
  console.log('Patched: ' + filePath);
  return true;
}

function findAndPatchAll(dir, depth) {
  if (depth < 0 || !fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findAndPatchAll(fullPath, depth - 1);
    } else if (entry.name === 'CMakeLists.txt') {
      patchFile(fullPath);
    }
  }
}

// Patch standard module locations
const standardModules = [
  'react-native-screens',
  'expo-modules-core',
  'react-native-worklets',
  'react-native-reanimated',
  'react-native-gesture-handler',
];

standardModules.forEach(mod => {
  const modPath = path.join(__dirname, 'node_modules', mod, 'android');
  findAndPatchAll(modPath, 8);
});

// Patch generated codegen CMakeLists in android/app/.cxx
const appCxxPath = path.join(__dirname, 'android', 'app', '.cxx');
findAndPatchAll(appCxxPath, 10);

// Patch build/generated codegen CMakeLists
const appBuildPath = path.join(__dirname, 'android', 'app', 'build', 'generated');
findAndPatchAll(appBuildPath, 10);

console.log('Done!');
