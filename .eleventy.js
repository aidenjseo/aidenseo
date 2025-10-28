module.exports = function(eleventyConfig) {
  // copy assets straight to _site
  eleventyConfig.addPassthroughCopy("src/assets");
  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" }
  };
};
