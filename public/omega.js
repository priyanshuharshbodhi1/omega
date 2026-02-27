document.addEventListener("DOMContentLoaded", function () {
  var omegaFrame;
  var omegaBtnOpen;
  var omegaScript = document.querySelector("script[omega-id]");
  var omegaId = omegaScript.getAttribute("omega-id") || "";
  var overrideMode = omegaScript.getAttribute("omega-mode") || "";
  var url = omegaScript.src.split("/omega.js")[0] || "";
  var appUrl = url;

  function Omega() {
    var self = this;

    fetch(`${appUrl}/api/team/${omegaId}`)
      .then((res) => res.json())
      .then((res) => {
        if (res?.success) {
          var dataTeam = res?.data;
          var widgetMode = overrideMode || dataTeam?.style?.widget_mode || "feedback";
          var collectPath =
            widgetMode === "customer_agent"
              ? `${appUrl}/collect/${omegaId}?mode=customer_agent`
              : `${appUrl}/collect/${omegaId}?mode=feedback`;
          var css = document.createElement("link");
          css.href = `${url}/omega.css`;
          css.type = "text/css";
          css.rel = "stylesheet";
          css.media = "screen";

          document.getElementsByTagName("head")[0].appendChild(css);
          var isSupportMode = widgetMode === "customer_agent";
          var btnHtml = isSupportMode
            ? `<a id="omega-btn-open" class="omega-toggle-feedback omega-btn-support" href="javascript:;" style="background: ${dataTeam?.style?.button_bg || '#1F1A15'};color: ${dataTeam?.style?.button_color || '#fff'}"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></a>`
            : `<a id="omega-btn-open" class="omega-toggle-feedback omega-btn-open-${dataTeam?.style?.button_position}" href="javascript:;" style="background: ${dataTeam?.style?.button_bg};color: ${dataTeam?.style?.button_color}">${dataTeam?.style?.button_text}</a>`;

          document.body.insertAdjacentHTML(
            "beforeend",
            `${btnHtml}

          <div id="omega-frame" class="omega-frame-closed" style="display:none;">
              <iframe allowfullscreen="true" class="omega-frame-embed" title="Omega" role="dialog" src="${collectPath}"></iframe>
          </div>`,
          );

          document.addEventListener("click", function (event) {
            var target = event.target;
            function prevent() {
              event.preventDefault();
              event.stopPropagation();
            }
            if (target.matches(".omega-toggle-feedback")) {
              self.toggle();
              prevent();
            } else if (target.matches(".omega-open-feedback")) {
              self.open();
              prevent();
            } else if (target.matches(".omega-close-feedback")) {
              self.close();
              prevent();
            }
          });

          omegaFrame = document.getElementById("omega-frame");
          omegaBtnOpen = document.getElementById("omega-btn-open");
        }
      });

    return self;
  }

  Omega.prototype.toggle = function () {
    var self = this;
    omegaFrame.style.display = "block";

    var isOpen = omegaFrame.classList.contains("omega-frame-open");
    if (isOpen) {
      omegaFrame.classList.remove("omega-frame-open");
      omegaFrame.classList.add("omega-frame-closed");

      omegaBtnOpen.style.display = "inline";
    } else {
      omegaFrame.classList.remove("omega-frame-closed");
      omegaFrame.classList.add("omega-frame-open");
      omegaFrame.classList.add("slide-in-bck-br");

      omegaBtnOpen.style.display = "none";
    }

    return self;
  };

  Omega.prototype.open = function () {
    var self = this;
    omegaFrame.style.display = "block";
    omegaFrame.classList.remove("omega-frame-closed");
    omegaFrame.classList.add("omega-frame-open");
    omegaFrame.classList.add("slide-in-bck-br");
    omegaBtnOpen.style.display = "none";
    return self;
  };

  Omega.prototype.close = function () {
    var self = this;
    omegaFrame.classList.remove("omega-frame-open");
    omegaFrame.classList.add("omega-frame-closed");
    omegaBtnOpen.style.display = "inline";
    return self;
  };

  window.omega = new Omega();
  window.addEventListener("message", (event) => {
    if (event.data == "omega-minimized") {
      window.omega.toggle();
    }
    return;
  });
});
