module.exports = function(eleventyConfig) {
  // copy assets straight to _site
  eleventyConfig.addPassthroughCopy("src/assets");

  // Auto-generate /title-slug/ permalinks for all pages except index
  eleventyConfig.addGlobalData("eleventyComputed", {
    permalink: (data) => {
      // If page already sets a permalink, use it
      if (data.permalink !== undefined) return data.permalink;
      // Index page keeps its default "/"
      if (data.page && data.page.fileSlug === "index") return "/";
      // All other pages: /title-slug/
      if (data.title) {
        const slug = data.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        return `/${slug}/`;
      }
      // Fallback to default
      return data.permalink;
    }
  });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" }
  };
};
