# Eat Sooner

Eat Sooner is a courier service for New York City restaurants. Restaurants keep taking their own orders by phone or website, then request an Eat Sooner courier when the food is ready. Couriers deliver by bike, e-bike, on foot or by transit, so no driver's license or car is needed. The service is built to give delivery work to people who were turned away by the big apps.

Launch areas: Sunnyside, Long Island City, Astoria, Midtown and Harlem.

## Pricing for restaurants

| Trip | Distance | Fee per delivery |
| --- | --- | --- |
| Short | Up to 0.5 mile | $5.25 |
| Standard | 0.5 to 1.5 miles | $5.75 |
| Long | 1.5 to 2.5 miles | $6.75 |

No contract and no setup fee. Every tip goes to the courier.

## What's in this repository

- **`web/`** is the real app, with separate sign-ins for restaurants, couriers and Eat Sooner staff. See [web/README.md](web/README.md) for what it does and how to set it up.
- **`index.html`** is the earlier clickable demo, described below.

## The demo

`index.html` is a clickable demo of both sides of the app in one page:

- **Restaurant:** enter a customer address, pick the trip distance, see the fee, and request a courier. The day's deliveries and fees add up below.
- **Courier:** go online, choose bike, e-bike, walk or transit, accept or decline an offer, then mark it picked up and delivered.

Open `index.html` in any web browser to try it. Both sides run on one device; use the tabs to switch between them.

### What the demo leaves out

The demo is not a live service. It has no accounts or logins, no ID or work-eligibility checks, no payments, no maps or real distances, and no messaging between phones. Data is kept only in the browser that opens the page. Courier pay is shown as "to be set" until it's decided.
