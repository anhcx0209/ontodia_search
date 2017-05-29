import { createElement, ClassAttributes } from 'react';
import * as ReactDOM from 'react-dom';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);    
});
