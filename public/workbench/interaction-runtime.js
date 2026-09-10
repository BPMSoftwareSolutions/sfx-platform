/* SideFX.UI HTML interaction runtime — provider mechanic.
 *
 * Executes an already-resolved interaction plan inside a browser. It carries
 * authority; it does not reconstruct authority.
 *
 * What this file knows: DOM events, element lookup, reading a value off an
 * input, toggling disabled, writing textContent. Provider mechanics.
 *
 * It does receive semantic FACTS - state ids, action ids, a scenario event
 * name, the message a validator chose. What it must never receive is authority
 * to reinterpret any of them: what `required` means, which rules apply to which
 * state, what a semantic action requires, how money should read, which scenario
 * to run. Every such decision was made before the page was built and arrives
 * already resolved.
 *
 * Each binding also declares the physical region it owns, and this file writes
 * nothing outside it.
 *
 * The op vocabulary below is deliberately mechanical. `nonEmpty` is not
 * `required`; it is what `required` was reduced to by validate-ui-state. Adding
 * a rule kind does not change this file — it changes the reduction, and an op
 * this runtime cannot execute is reported at realization time rather than
 * guessed at here.
 */
(function (global) {
  "use strict";

  // A dialog and its host are independent resolved surfaces. Each mount owns
  // only its subtree; the same lowered mechanics serve both surfaces.
  function mount(root, plan, initialValues) {

  var state = {};
  plan.state.forEach(function (item) { state[item.stateId] = initialValues && Object.prototype.hasOwnProperty.call(initialValues, item.stateId)
    ? initialValues[item.stateId] : item.initialValue; });

  function el(componentId) {
    return root.querySelector("[" + plan.componentAttribute + "=\"" + componentId + "\"]");
  }

  /* --- mechanic ops. No semantic name appears here. -------------------- */
  var OPS = {
    nonEmpty: function (v) {
      if (v === null || v === undefined || v === "") { return false; }
      if (Array.isArray(v)) { return v.length > 0; }
      if (typeof v === "object") { return Object.keys(v).length > 0; }
      return true;
    },
    atLeast:   function (v, n) { return v >= n; },
    atMost:    function (v, n) { return v <= n; },
    minLength: function (v, n) { return (typeof v === "string" ? Array.from(v).length : v.length) >= n; },
    maxLength: function (v, n) { return (typeof v === "string" ? Array.from(v).length : v.length) <= n; },
    matches:   function (v, p) { return new RegExp(p).test(String(v)); },
    memberOf:  function (v, s) { return s.indexOf(v) !== -1; }
  };

  function reach(value, path) {
    if (!path) { return value; }
    return path.split(".").reduce(function (acc, part) {
      return (acc && typeof acc === "object" && part in acc) ? acc[part] : null;
    }, value);
  }

  /* Absence is the business of nonEmpty alone — the same rule the semantic
   * capability holds, carried here rather than re-decided. */
  function evaluate(stateId) {
    var declared = plan.validation.filter(function (v) { return v.state === stateId; })[0];
    if (!declared) { return { admissible: true, message: null, violations: [] }; }
    var violations = [];
    declared.checks.forEach(function (check) {
      var target = reach(state[stateId], check.valuePath);
      if (check.op !== "nonEmpty" && (target === null || target === undefined)) { return; }
      var op = OPS[check.op];
      if (!op) { return; }
      if (!op(target, check.operand)) { violations.push(check.message); }
    });
    return {
      admissible: violations.length === 0,
      message: violations.length ? violations[0] : null,
      violations: violations
    };
  }

  function dispositions() {
    var out = {};
    plan.validation.forEach(function (v) { out[v.state] = evaluate(v.state); });
    return out;
  }

  /* --- reflection: physical DOM realization of resolved outcomes ------- */
  function reflect() {
    var judged = dispositions();
    plan.bindings.filter(function (b) { return b.writable; }).forEach(function (b) {
      var node = el(b.component), control = node && node.querySelector(b.accessor.selector);
      if (control && judged[b.state]) control.setAttribute('aria-invalid', String(!judged[b.state].admissible));
    });

    plan.bindings.filter(function (b) { return b.aspect === "validation"; })
      .forEach(function (b) {
        var node = el(b.component);
        if (!node) { return; }
        var judgement = judged[b.state];
        /* Only the physical region this binding declares it owns. Writing
         * outside it rewrites structure the projection built, which is a
         * higher-altitude realization this mechanic does not own. */
        var target = node.querySelector(b.mutates.selector);
        if (!target) { return; }
        target[b.mutates.property] =
          (judgement && judgement.message) || b.fallbackText || "";
      });

    plan.actions.forEach(function (action) {
      var unmet = action.requiresAdmissible.filter(function (stateId) {
        var judgement = judged[stateId];
        return !judgement || !judgement.admissible;
      });
      var admissible = action.availability === "available" && unmet.length === 0;
      var reason = admissible ? null
        : (unmet.length ? (judged[unmet[0]] && judged[unmet[0]].message)
                        : "this action is currently unavailable");
      action.components.forEach(function (componentId) {
        var node = el(componentId);
        if (!node) { return; }
        var control = node.querySelector("[" + plan.reflect.action.dispositionAttribute + "]") || node;
        control[plan.reflect.action.disabledProperty] = !admissible;
        control.setAttribute(plan.reflect.action.dispositionAttribute,
          admissible ? "ADMISSIBLE" : (action.availability === "available"
            ? "NOT_ADMISSIBLE" : "UNAVAILABLE"));
        if (reason) { control.setAttribute(plan.reflect.action.reasonAttribute, reason); }
        else { control.removeAttribute(plan.reflect.action.reasonAttribute); }
      });
    });

    /* Testimony, so an observer can read current interaction reality off the
     * document rather than inferring it from pixels. */
    root.setAttribute("data-sidefx-state", JSON.stringify(state));
    root.setAttribute("data-sidefx-admissibility", JSON.stringify(
      Object.keys(judged).reduce(function (acc, k) {
        acc[k] = judged[k].admissible; return acc;
      }, {})));
  }

  /* --- physical input observation ------------------------------------- */
  plan.bindings.filter(function (b) { return b.writable; }).forEach(function (b) {
    var node = el(b.component);
    if (!node) { return; }
    var control = node.querySelector(b.accessor.selector);
    if (!control) { return; }
    b.accessor.events.forEach(function (eventName) {
      control.addEventListener(eventName, function () {
        var raw = control[b.accessor.readFrom];
        state[b.state] = (b.coerce === "number") ? Number(raw) : raw;
        reflect();
      });
    });
    /* Initial physical value comes from resolved state, once. */
    if (state[b.state] !== null && state[b.state] !== undefined) {
      control[b.accessor.writeTo] = state[b.state];
    }
  });

  /* --- the SDA boundary ------------------------------------------------ */
  plan.actions.forEach(function (action) {
    action.components.forEach(function (componentId) {
      var node = el(componentId);
      if (!node) { return; }
      /* The wrapper is never disabled, so the runtime always gets to decide.
       * A listener on the control itself would never fire while disabled, and
       * the disabled attribute would become the enforcement rather than a
       * drawing of it. */
      node.addEventListener("click", function () {
        var judged = dispositions();
        var unmet = action.requiresAdmissible.filter(function (stateId) {
          return !judged[stateId] || !judged[stateId].admissible;
        });
        if (action.availability !== "available" || unmet.length) {
          /* NOT_ADMISSIBLE terminates inside the UI circuit. */
          root.setAttribute("data-sidefx-last-dispatch",
            JSON.stringify({ actionId: action.actionId, disposition: "NOT_ADMISSIBLE" }));
          root.dispatchEvent(new CustomEvent("sidefx-ui-action", { detail: { actionId: action.actionId, disposition: "NOT_ADMISSIBLE" } }));
          return;
        }
        /* ADMISSIBLE reaches the port and stops. This runtime realizes
         * interaction; it does not realize the business event. Crossing needs
         * execute-scenario-event, which this estate does not have. */
        var dispatch = {
          actionId: action.actionId,
          disposition: "DISPATCHED",
          scenarioEvent: action.scenarioEvent,
          execution: { state: "NOT_ATTEMPTED",
                       providerCapability: "execute-scenario-event",
                       providerStatus: "unavailable" }
        };
        root.setAttribute("data-sidefx-last-dispatch", JSON.stringify(dispatch));
        root.dispatchEvent(new CustomEvent("sidefx-ui-action", { detail: dispatch }));
      });
    });
  });

  reflect();
  return { state: function () { return Object.assign({}, state); }, judgements: dispositions };
  }
  global.SidefxUIRuntime = { mount: mount };
  var planNode = typeof document !== "undefined" && document.getElementById("sidefx-ui-plan");
  if (planNode) mount(document.documentElement, JSON.parse(planNode.textContent));
})(globalThis);
