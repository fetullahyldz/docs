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

const {GitHubImporter} = require('./gitHubImporter');

// Where to save the documents/collection to
const DESTINATION_BASE_PATH =
  __dirname + '/../../../pages/content/amp-dev/documentation/components/reference';
// Names of the built-in components that need to be fetched from ...
const BUILT_INS = ['amp-img', 'amp-pixel', 'amp-layout'];
// ... this path
const BUILT_IN_PATH = 'builtins';

class ComponentReferenceImporter extends GitHubImporter {
  async import() {
    this._log.start('Beginning to import extension docs ...');
    await this._importExtensionsDocs();
  }

  /**
   * Collects all needed documents from across the repository that should
   * be downloaded and put into collections
   * @return {undefined}
   */
  async _importExtensionsDocs() {
    // Gives the contents of ampproject/amphtml/extensions
    let extensions = await this._repository.contentsAsync('extensions', this._latestReleaseTag);
    const categories = require(__dirname + '/../../config/imports/componentCategories.json');

    // As inside /extensions each component has its own folder filter
    // down by directory
    extensions = extensions[0].filter((doc) => doc.type === 'dir');

    // Add built-in components to list to fetch them all in one go
    for (const builtInExtension of BUILT_INS) {
      extensions.push({'name': builtInExtension, 'path': BUILT_IN_PATH});
    }

    // Keep track of all saved documents (as promises) to complete function
    const savedDocuments = [];
    for (const extension of extensions) {
      const document = await this._findExtensionDoc(extension);

      if (!document) {
        this._log.warn(`No matching document for component: ${extension.name}`);
      } else {
        // Ensure that the document has a TOC
        document.toc = true;
        // And try to add in the matching category
        document.category = categories[extension.name];
        savedDocuments.push(this._saveDocument(extension.name, document));
      }
    }


    return Promise.all(savedDocuments);
  }

  /**
   * Builds the destination path from the document's file name and
   * @param  {Document} document The component's reference
   * @return {undefined}
   */
  _saveDocument(extensionName, document) {
    // Set the documents title
    document.title = extensionName;
    const documentPath = `${DESTINATION_BASE_PATH}/${extensionName}.md`;

    return document.save(documentPath).then(() => {
      this._log.success('Saved document to ' + documentPath);
    }).catch((e) => {
      this._log.success('There was an error saving the document to ' + documentPath);
      throw e;
    });
  }

  /**
   * Checks a specific extension/component for documents
   * @return {Promise} [description]
   */
  async _findExtensionDoc(extension) {
    let files = await this._repository.contentsAsync(extension.path, this._latestReleaseTag);
    files = files[0];

    // Find the Markdown document that is named like the extension
    let documentPath = '';
    for (let i = 0; i < files.length; i++) {
      if (files[i].type === 'file' && files[i].name === extension.name + '.md') {
        documentPath = files[i].path;
        break;
      }
    }

    if (!documentPath) {
      this._log.warn(`No matching document for component: ${extension.name}`);
      return;
    }

    return this._fetchDocument(documentPath);
  }
}

// If not required, run directly
if (!module.parent) {
  const importer = new ComponentReferenceImporter();

  (async () => {
    await importer.initialize();
    await importer.import();
  })();
}

module.exports = ComponentReferenceImporter;
