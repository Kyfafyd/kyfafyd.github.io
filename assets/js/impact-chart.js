// Swaps the static impact chart on the publications page for an inline copy of the same SVG and adds a hover
// readout, using the weekly values the SVG carries in <metadata id="impact-series">.
(function () {
  var box = document.querySelector(".impact-chart");
  if (!box || !window.fetch || !window.DOMParser) return;

  var SVG_NS = "http://www.w3.org/2000/svg";

  // Cloudflare tells browsers to keep files for four hours; an hourly key picks up the daily refresh within the hour.
  fetch(box.getAttribute("data-src") + "?v=" + new Date().toISOString().slice(0, 13))
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.text();
    })
    .then(function (text) {
      var svg = document.importNode(new DOMParser().parseFromString(text, "image/svg+xml").documentElement, true);
      var data = JSON.parse(svg.querySelector("#impact-series").textContent);
      // An inline <title> becomes the browser's own tooltip, which would pop up over the readout.
      var title = svg.querySelector("title");
      if (title) {
        svg.setAttribute("aria-label", title.textContent);
        svg.removeChild(title);
      }
      svg.removeAttribute("height");
      svg.setAttribute("width", "100%");
      svg.style.display = "block";
      svg.style.height = "auto";
      svg.style.touchAction = "pan-y";
      box.replaceChild(svg, box.querySelector("img"));
      addReadout(svg, data);
    })
    .catch(function () {
      // The static image stays in place.
    });

  function create(name, attributes) {
    var node = document.createElementNS(SVG_NS, name);
    for (var key in attributes) node.setAttribute(key, attributes[key]);
    return node;
  }

  function addReadout(svg, data) {
    var guide = create("line", { y1: data.top, y2: data.bottom, stroke: "#7a8288", "stroke-dasharray": "3 3", visibility: "hidden" });
    svg.appendChild(guide);
    var dots = data.series.map(function (series) {
      var dot = create("circle", { r: 4, fill: series.color, stroke: "#fff", "stroke-width": 2, visibility: "hidden" });
      svg.appendChild(dot);
      return dot;
    });
    var tip = document.createElement("div");
    tip.style.cssText = "position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;white-space:nowrap;" +
      "background:#fff;border:1px solid #e1e4e7;border-radius:4px;padding:6px 10px;font-size:13px;line-height:1.6;color:#494e52";
    box.appendChild(tip);

    function nearest(x) {
      var points = data.points, low = 0, high = points.length - 1;
      while (high - low > 1) {
        var middle = (low + high) >> 1;
        if (points[middle][1] < x) low = middle;
        else high = middle;
      }
      return x - points[low][1] < points[high][1] - x ? points[low] : points[high];
    }

    function show(event) {
      var matrix = svg.getScreenCTM();
      if (!matrix) return;
      var point = nearest((event.clientX - matrix.e) / matrix.a);
      guide.setAttribute("x1", point[1]);
      guide.setAttribute("x2", point[1]);
      guide.setAttribute("visibility", "visible");

      tip.textContent = "";
      var heading = document.createElement("div");
      heading.style.fontWeight = "600";
      heading.textContent = new Date(point[0] + "T00:00:00Z").toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
      });
      tip.appendChild(heading);
      data.series.forEach(function (series, index) {
        var value = point[2][index];
        dots[index].setAttribute("visibility", value === null ? "hidden" : "visible");
        if (value === null) return;
        dots[index].setAttribute("cx", point[1]);
        dots[index].setAttribute("cy", point[3][index]);
        var row = document.createElement("div");
        var swatch = document.createElement("span");
        swatch.style.cssText = "display:inline-block;width:8px;height:8px;margin-right:6px;border-radius:50%;background:" + series.color;
        row.appendChild(swatch);
        row.appendChild(document.createTextNode(value.toLocaleString("en-US") + " " + series.name));
        tip.appendChild(row);
      });

      var bounds = box.getBoundingClientRect();
      var left = matrix.a * point[1] + matrix.e - bounds.left;
      var flip = left + 12 + tip.offsetWidth > bounds.width;
      tip.style.left = (flip ? left - 12 - tip.offsetWidth : left + 12) + "px";
      tip.style.top = matrix.d * data.top + matrix.f - bounds.top + "px";
      tip.style.visibility = "visible";
    }

    function hide() {
      guide.setAttribute("visibility", "hidden");
      dots.forEach(function (dot) { dot.setAttribute("visibility", "hidden"); });
      tip.style.visibility = "hidden";
    }

    svg.addEventListener("pointermove", show);
    svg.addEventListener("pointerdown", show);
    // On touch screens the readout stays after a tap instead of vanishing as the finger lifts.
    svg.addEventListener("pointerleave", function (event) {
      if (event.pointerType === "mouse") hide();
    });
  }
})();
