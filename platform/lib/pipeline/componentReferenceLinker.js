/**
 * Copyright 2018 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const {Signale} = require('signale');
const gulp = require('gulp');
const through = require('through2');
const path = require('path');
const fs = require('fs');

// Where to look for existing documents
const POD_BASE_PATH = path.join(__dirname, '../../../pages/');
// Which documents to check for broken references
// const PAGES_SRC = POD_BASE_PATH + 'content/amp-dev/documentation/guides-and-tutorials/**/*.md';
const PAGES_SRC = POD_BASE_PATH + 'content/amp-dev/documentation/guides-and-tutorials/develop/third_party_components.md';
const COMPONENTS_SRC = POD_BASE_PATH + 'content/amp-dev/documentation/components/';

/**
 * Walks over documents inside the Grow pod and looks for broken links either
 * in a syntax like `g.doc('...')` or []() and checks if the linked document
 * exists at the pointed path and tries to adjust the path if not
 */
class ComponentReferenceLinker {
  constructor() {
    this._log = new Signale({
      'scope': 'Reference linker',
    });
    this._placeholders = {};
  }

  async start() {
    this._log.start(`Inspecting documents in ${PAGES_SRC} ...`);

    return new Promise((resolve, reject) => {
      let stream = gulp.src(PAGES_SRC, {'read': true, 'base': './'});
      stream = stream.pipe(through.obj((doc, encoding, callback) => {
        // this._log.await(`Checking ${doc.relative} ...`);
        stream.push(this._link(doc));
        callback();
      }));

      stream.pipe(gulp.dest('./'));
      stream.on('end', () => {
        this._log.complete('Linked all component references!');

        resolve();
      });
    });
  }

  _link(doc) {
    return this._check(doc);
  }

  _check(doc) {
    let content = doc.contents.toString();

    // Cases
    const cases = [
      content.match(/\[amp-\w*(-\w*)*\]\(\/docs\/reference\/components\/\w*-\w*(-\w*)*\.html\)/gm),
      content.match(/\[`amp-\w*(-\w*)*\`]\(\/docs\/reference\/components\/\w*-\w*(-\w*)*\.html\)/gm),
      content.match(/\[amp-\w*(-\w*)*]\(https:\/\/www.ampproject.org\/docs\/reference\/components\/\w*-\w*(-\w*)*\)/gm),
      content.match(/\[\`amp-\w*(-\w*)*\`]\(https:\/\/www.ampproject.org\/docs\/reference\/components\/\w*-\w*(-\w*)*\)/gm),
      content.match(/\`amp-\w*(-\w*)*`/gm),
      content.match(/amp-\w*(-\w*)*/gm),
    ];

    for (let i = 0; i < cases.length; i++) {
      const results = Array.from(new Set(cases[i]));
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        console.log(result);
        if (i > 3 && (result.includes(']') || result.includes('/') || result.includes('"'))) {
          this._log.error(result);
          continue;
        }

        const component = result.match(/amp-\w*(-\w*)*/g)[0];
        if (this._componentExist(component) === true) {
          this._log.start(this._componentPath(component));
          while (content.includes(result)) {
            content = content.replace(result, this._createPlaceholder(component));
          }
        } else {
          this._log.error(component);
        }
      }
    }

    for (const placeholder of Object.keys(this._placeholders)) {
      while (content.includes(placeholder)) {
        content = content.replace(placeholder, this._placeholders[placeholder]);
      }
    }

    doc.contents = Buffer.from(content);
    return doc;
  }

  _hash(str) {
  	let hash = 0;
  	if (this.length == 0) return hash;
  	for (let i = 0; i < this.length; i++) {
  		char = this.charCodeAt(i);
  		hash = ((hash<<5)-hash)+char;
  		hash = hash & hash; // Convert to 32bit integer
  	}
  	return hash;
  }

  _createPlaceholder(component) {
    const placeholder = `<!--${this._hash(component)}-->`;
    if (!this._placeholders[placeholder]) {
      this._placeholders[placeholder] = this._componentPath(component);
    }
    return placeholder;
  }

  _componentPath(component) {
    const char = component.slice(4, 5).toUpperCase();
    const path = `({{g.doc('/content/amp-dev/documentation/components/${char}/${component}.md', locale=doc.locale).url.path}})`;
    return `[\`${component}\`]${path}`;
  }

  _componentExist(component) {
    const char = component.slice(4, 5).toUpperCase();
    const path = COMPONENTS_SRC + char + '/' + component + '.md';

    if (fs.existsSync(path)) {
      return true;
    }
  }
}

// If not required, run directly
if (!module.parent) {
  const referenceLinker = new ComponentReferenceLinker();
  referenceLinker.start();
}

module.exports = ComponentReferenceLinker;
