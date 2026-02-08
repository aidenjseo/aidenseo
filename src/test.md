---
title: Aiden Seo
layout: base.njk
loadRnaScripts: true
templateEngineOverride: njk
---

<section class="brand-hero" aria-label="brand">
  <div class="brand-copy">
    <p class="main-line">
      <span data-rna-root>i am a korean american </span>
      <span data-rna-phrase></span>
    </p>
    <div class="rna-sequence">
      <span class="trans" data-rna-sequence data-rna-speed="1.5">
        {% if rnaSequences %}
          {%- for entry in rnaSequences %}
            <span class="rna-sequence-line">{{ entry.sequence | trim }}</span>
          {%- endfor %}
        {% endif %}
      </span>
    </div>
  </div>
  <p class="lrfa">leave room for air</p>
  <div class="brand-logo-kr" aria-hidden="true">
    <p class="big-logo-kr">서정민</p>
  </div>
  <div class="brand-logo" role="banner">
    <h1 class="big-logo" aria-label="aidenseo">
      <span>a</span><span>i</span><span>d</span><span>e</span><span>n</span
      ><span>s</span><span>e</span><span>o</span>
    </h1>
  </div>
</section>
