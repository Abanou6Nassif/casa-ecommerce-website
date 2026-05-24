import { src, dest, series, parallel, watch } from "gulp";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import htmlmin from "gulp-html-minifier-terser";
import replace from "gulp-replace";
import postcssUrl from "postcss-url";
import GulpPostCss from "gulp-postcss";
import concat from "gulp-concat";
import GulpCleanCss from "gulp-clean-css";
import terser from "gulp-terser";
import optimizeImages from "gulp-optimize-images";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

async function cleanTask() {
  await fs.rm("dist", { recursive: true, force: true });
}

const globs = {
  html: "./*.html",
  css: "./*.css",
  js: "./script.js",
  img: "./img/**/*.{png,jpg,jpeg}",
  videos: "./img/**/*.{mp4,webm,mov,mkv,avi}",
};

function htmlTask() {
  return src(globs.html)
    .pipe(replace(/href="style\.css"/g, 'href="style.min.css"'))
    .pipe(replace(/src="script\.js"/g, 'src="script.min.js"'))
    .pipe(htmlmin({ collapseWhitespace: true, removeComments: true }))
    .pipe(dest("dist"));
}

function cssTask() {
  return src(globs.css)
    .pipe(GulpPostCss([postcssUrl({ url: "rebase" })]))
    .pipe(concat("style.min.css"))
    .pipe(GulpCleanCss())
    .pipe(dest("dist"));
}

function javaScriptTask() {
  return src(globs.js, { sourcemaps: true })
    .pipe(concat("script.min.js"))
    .pipe(terser())
    .pipe(dest("dist", { sourcemaps: "." }));
}

function imgTask() {
  return src(globs.img, { encoding: false, base: "." }).pipe(
    optimizeImages({
      compressOptions: {
        jpeg: { quality: 60 },
        png: { quality: [0.6, 0.8] },
      },
    }).pipe(dest("dist")),
  );
}

async function videoTask() {
  const videoFiles = await new Promise((resolve, reject) => {
    const files = [];

    src(globs.videos, { allowEmpty: true, base: "." })
      .on("data", (file) => files.push(file))
      .on("error", reject)
      .on("end", () => resolve(files));
  });

  await Promise.all(
    videoFiles.map(async (file) => {
      const outputPath = path.join("dist", file.relative);

      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      await execFileAsync(ffmpegPath, [
        "-y",
        "-i",
        file.path,
        "-c:v",
        "libx264",
        "-crf",
        "28",
        "-preset",
        "medium",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        outputPath,
      ]);
    }),
  );
}

function watchTask() {
  watch(globs.html, htmlTask);
  watch(globs.css, cssTask);
  watch(globs.js, javaScriptTask);
  watch(globs.img, imgTask);
  watch(globs.videos, videoTask);
}

const build = series(
  cleanTask,
  cssTask,
  htmlTask,
  javaScriptTask,
  imgTask,
  videoTask,
  watchTask,
);

export default build;
