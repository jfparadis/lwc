/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
const { generateError, staticClassProperty, markAsLWCNode, isLWCNode } = require('../../utils');
const {
    LWC_PACKAGE_EXPORTS: { TRACK_DECORATOR },
    LWC_COMPONENT_PROPERTIES,
} = require('../../constants');
const { DecoratorErrors } = require('@lwc/errors');

const TRACK_PROPERTY_VALUE = 1;

function isTrackDecorator(decorator) {
    return decorator.name === TRACK_DECORATOR;
}

function validate(klass, decorators) {
    decorators.filter(isTrackDecorator).forEach(({ path }) => {
        if (!path.parentPath.isClassProperty()) {
            throw generateError(path, {
                errorInfo: DecoratorErrors.TRACK_ONLY_ALLOWED_ON_CLASS_PROPERTIES,
            });
        }
    });
}

function getDecoratedIdentifiers(decorators) {
    return decorators.map(({ path }) => path.parentPath.get('key.name').node);
}

function transform(t, klass, decorators) {
    const trackDecorators = decorators.filter(isTrackDecorator);
    let trackProperties = [];

    // Add metadata to class body
    if (trackDecorators.length) {
        trackProperties = getDecoratedIdentifiers(trackDecorators);
    } else {
        // Implicit branch: All non lwc decorated properties are tracked.
        const allLwcDecoratedProperties = new Set(getDecoratedIdentifiers(decorators));

        trackProperties = klass
            .get('body.body')
            .filter(
                path =>
                    t.isClassProperty(path.node) &&
                    !isLWCNode(path.node) &&
                    !allLwcDecoratedProperties.has(path.get('key.name').node)
            )
            .map(path => path.get('key.name').node);
    }

    if (trackProperties.length) {
        const trackConfig = trackProperties.reduce((acc, fieldName) => {
            // Transform list of fields to an object
            acc[fieldName] = TRACK_PROPERTY_VALUE;
            return acc;
        }, {});

        const staticProp = staticClassProperty(
            t,
            LWC_COMPONENT_PROPERTIES.TRACK,
            t.valueToNode(trackConfig)
        );
        markAsLWCNode(staticProp);

        klass.get('body').pushContainer('body', staticProp);
    }
}

module.exports = {
    name: TRACK_DECORATOR,
    transform,
    validate,
};
