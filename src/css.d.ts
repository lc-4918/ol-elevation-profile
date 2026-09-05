// `import 'ol-elevation-profile/css'` is a side-effect import of a stylesheet: there is
// nothing to type, but without a declaration TypeScript refuses the subpath outright
// (TS2882), and the README's own instructions would not compile.
export {};
